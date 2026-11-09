import { BASE_ID, Location, Vehicle, locations, vehicles, rules } from '../config/catalog.js';
import ApiError from '../utils/ApiError.js';

// Fare engine for outstation cab hire, the way Indian operators price it:
//   one way     billed on distance with a minimum, at a higher per-km rate (the driver returns empty)
//   round trip  billed on max(actual km, daily minimum x days), at a lower per-km rate
//   plus        driver night stay, night pickup, peak-season uplift
//   passed on   tolls and inter-state permits at estimated actuals (no GST on these)
//   then        GST on the service portion only, and a round-off to the nearest Rs 10
// All money is whole rupees. Every line is rounded as it is created, so the lines always add up to the total.

export type TripType = 'oneway' | 'roundtrip';
export type FareGroup = 'fare' | 'extra' | 'passthrough' | 'tax' | 'adjust';

export interface FareLine {
  code: string;
  label: string;
  detail?: string;
  amount: number;
  group: FareGroup;
}

export interface Fare {
  vehicleId: Vehicle['id'];
  vehicleName: string;
  seats: number;
  perKm: number;
  billableKm: number;
  lines: FareLine[];
  total: number;
  fits: boolean; // false when the party is bigger than the vehicle
}

export interface TripQuote {
  pickup: { id: string; name: string };
  destination: { id: string; name: string };
  tripType: TripType;
  distanceKm: number;   // one-way, estimated
  durationMin: number;  // one-way, estimated
  days: number;
  nights: number;
  peak: string | null;  // name of the peak window the pickup falls in, if any
  nightPickup: boolean;
  fares: Fare[];
  notes: string[];
}

export interface QuoteInput {
  pickupId: string;
  destinationId: string;
  tripType: TripType;
  pickupAt?: Date;     // omitted for "from" prices, which skip date-based rules
  returnDate?: string; // YYYY-MM-DD, India date. Round trips only.
  passengers?: number;
}

const byId = new Map(locations.map((l) => [l.id, l]));
const base = byId.get(BASE_ID) as Location;

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const toIst = (d: Date): Date => new Date(d.getTime() + IST_OFFSET_MS); // read with the getUTC* methods
const istDateKey = (d: Date): string => toIst(d).toISOString().slice(0, 10);
const dayNumber = (key: string): number => Date.parse(`${key}T00:00:00Z`) / DAY_MS;

const rad = (deg: number): number => (deg * Math.PI) / 180;
const haversineKm = (a: Location, b: Location): number => {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

// Road distance. Legs from Ramnagar are curated. Any other pair is estimated from the straight line, scaled by
// how winding each end's road from Ramnagar is, then bounded by the triangle inequality so it can never be
// shorter than the difference of the two legs nor longer than their sum.
const roadKmBetween = (a: Location, b: Location): number => {
  if (a.id === b.id) return 0;
  if (a.id === BASE_ID) return b.roadKm;
  if (b.id === BASE_ID) return a.roadKm;

  const winding = (l: Location): number => clamp(l.roadKm / Math.max(haversineKm(base, l), 1), 1.15, 2.2);
  const estimate = haversineKm(a, b) * ((winding(a) + winding(b)) / 2);
  const lo = Math.abs(a.roadKm - b.roadKm);
  const hi = a.roadKm + b.roadKm;
  return Math.max(1, Math.round(clamp(estimate, lo, hi)));
};

const speedKmPerMin = (l: Location): number => l.roadKm / Math.max(l.driveMin, 1);

const driveMinBetween = (a: Location, b: Location, km: number): number => {
  if (a.id === BASE_ID) return b.driveMin;
  if (b.id === BASE_ID) return a.driveMin;
  const speed = (speedKmPerMin(a) + speedKmPerMin(b)) / 2;
  return Math.max(5, Math.round(km / speed));
};

// Tolls behave like a position along the corridor from Ramnagar, so the toll between two places is the
// difference of their positions. For trips that start at Ramnagar this is exact.
const tollBetween = (a: Location, b: Location): number => Math.abs(a.tollFromBase - b.tollFromBase);

const peakWindowFor = (pickupAt: Date): string | null => {
  const ist = toIst(pickupAt);
  const md = (ist.getUTCMonth() + 1) * 100 + ist.getUTCDate();
  for (const w of rules.peakWindows) {
    const from = w.from[0] * 100 + w.from[1];
    const to = w.to[0] * 100 + w.to[1];
    const inside = from <= to ? md >= from && md <= to : md >= from || md <= to; // wraps the new year
    if (inside) return w.label;
  }
  return null;
};

const isNightPickup = (pickupAt: Date): boolean => {
  const hour = toIst(pickupAt).getUTCHours();
  const { fromHour, toHour } = rules.nightPickup;
  return hour >= fromHour || hour < toHour;
};

const percentOf = (amount: number, percent: number): number => Math.round((amount * percent) / 100);
const inr = (n: number): string => `₹${n.toLocaleString('en-IN')}`;
const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

interface TripShape {
  tripType: TripType;
  distanceKm: number;
  days: number;
  nights: number;
  tolls: number;        // for the whole trip, both ways on a round trip
  leavesState: boolean;
  nightPickup: boolean;
  peak: string | null;
}

const priceVehicle = (v: Vehicle, t: TripShape, passengers: number): Fare => {
  const lines: FareLine[] = [];
  const add = (line: FareLine): void => {
    if (line.amount !== 0) lines.push(line);
  };

  // ---- core fare ----
  let billableKm: number;
  let perKm: number;
  let baseDetail: string;

  if (t.tripType === 'oneway') {
    const minKm = t.distanceKm <= rules.localRadiusKm ? rules.localOneWayMinKm : rules.oneWayMinKm;
    billableKm = Math.max(t.distanceKm, minKm);
    perKm = v.oneWayPerKm;
    baseDetail = t.distanceKm < minKm
      ? `${minKm} km minimum × ${inr(perKm)}/km`
      : `${t.distanceKm} km × ${inr(perKm)}/km`;
  } else {
    const dailyMin = t.distanceKm <= rules.localRadiusKm ? rules.localMinKmPerDay : rules.outstationMinKmPerDay;
    const actual = t.distanceKm * 2;
    const minimum = dailyMin * t.days;
    billableKm = Math.max(actual, minimum);
    perKm = v.roundTripPerKm;
    baseDetail = actual >= minimum
      ? `${actual} km (there and back) × ${inr(perKm)}/km`
      : `${dailyMin} km/day minimum × ${plural(t.days, 'day')} × ${inr(perKm)}/km`;
  }

  const rawBase = Math.round(billableKm * perKm);
  const baseFare = Math.max(rawBase, v.minFare);
  add({
    code: 'base',
    label: 'Base fare',
    detail: rawBase < v.minFare ? `Minimum fare for a ${v.name.toLowerCase()}` : baseDetail,
    amount: baseFare,
    group: 'fare',
  });

  // ---- service extras ----
  const driverStay = t.nights * v.nightStayPerNight;
  add({
    code: 'driver_stay',
    label: 'Driver night stay',
    detail: `${plural(t.nights, 'night')} × ${inr(v.nightStayPerNight)}`,
    amount: driverStay,
    group: 'extra',
  });

  const nightCharge = t.nightPickup ? rules.nightPickup.charge : 0;
  add({ code: 'night_pickup', label: 'Night pickup', detail: 'Pickup between 11 pm and 4 am', amount: nightCharge, group: 'extra' });

  const peakCharge = t.peak ? percentOf(baseFare, rules.peakSurchargePercent) : 0;
  add({ code: 'peak', label: 'Peak season', detail: `${t.peak}, ${rules.peakSurchargePercent}% of base fare`, amount: peakCharge, group: 'extra' });

  // ---- passed on at estimated actuals ----
  add({
    code: 'tolls',
    label: 'Tolls (estimated)',
    detail: t.tripType === 'roundtrip' ? 'Both ways, billed at actuals' : 'Billed at actuals',
    amount: t.tolls,
    group: 'passthrough',
  });
  add({
    code: 'permit',
    label: 'Inter-state permit',
    detail: 'The trip leaves Uttarakhand',
    amount: t.leavesState ? v.interstatePermit : 0,
    group: 'passthrough',
  });

  // ---- tax and round-off ----
  const taxable = baseFare + driverStay + nightCharge + peakCharge;
  add({ code: 'gst', label: `GST ${rules.gstPercent}%`, detail: 'On fare and service charges', amount: percentOf(taxable, rules.gstPercent), group: 'tax' });

  const exact = lines.reduce((sum, l) => sum + l.amount, 0);
  const rounded = Math.round(exact / rules.roundOffTo) * rules.roundOffTo;
  add({ code: 'round_off', label: 'Round off', amount: rounded - exact, group: 'adjust' });

  return {
    vehicleId: v.id,
    vehicleName: v.name,
    seats: v.seats,
    perKm,
    billableKm,
    lines,
    total: rounded,
    fits: passengers <= v.seats,
  };
};

const requireLocation = (id: string, field: string): Location => {
  const found = byId.get(id);
  if (!found) throw new ApiError(400, `Unknown ${field}`);
  return found;
};

const priceTrip = (input: QuoteInput): TripQuote => {
  const pickup = requireLocation(input.pickupId, 'pickup location');
  const destination = requireLocation(input.destinationId, 'destination');
  if (pickup.id === destination.id) throw new ApiError(400, 'Pickup and destination must be different places');

  const passengers = input.passengers ?? 1;
  const distanceKm = roadKmBetween(pickup, destination);
  const durationMin = driveMinBetween(pickup, destination, distanceKm);

  let nights = 0;
  if (input.tripType === 'roundtrip' && input.returnDate) {
    if (!input.pickupAt) throw new ApiError(400, 'pickupAt is required for a round trip with a return date');
    nights = dayNumber(input.returnDate) - dayNumber(istDateKey(input.pickupAt));
    if (!Number.isInteger(nights) || nights < 0) throw new ApiError(400, 'Return date cannot be before the pickup date');
    if (nights > rules.maxNights) throw new ApiError(400, `Round trips can be at most ${rules.maxNights} nights`);
  }

  const tripToll = tollBetween(pickup, destination) * (input.tripType === 'roundtrip' ? 2 : 1);

  const shape: TripShape = {
    tripType: input.tripType,
    distanceKm,
    days: nights + 1,
    nights,
    tolls: tripToll,
    leavesState: pickup.state !== 'UT' || destination.state !== 'UT',
    nightPickup: input.pickupAt ? isNightPickup(input.pickupAt) : false,
    peak: input.pickupAt ? peakWindowFor(input.pickupAt) : null,
  };

  return {
    pickup: { id: pickup.id, name: pickup.name },
    destination: { id: destination.id, name: destination.name },
    tripType: input.tripType,
    distanceKm,
    durationMin,
    days: shape.days,
    nights,
    peak: shape.peak,
    nightPickup: shape.nightPickup,
    fares: vehicles.map((v) => priceVehicle(v, shape, passengers)),
    notes: [
      'Distance and drive time are estimates. If the trip runs longer, the extra kilometres are billed at the same per-km rate.',
      'Tolls and permits are estimates and are billed at actuals. Parking and entry fees (for example safari gates) are paid directly by you.',
    ],
  };
};

// The cheapest sensible price for a route, used for "from ₹X" labels. Ignores dates, so no seasonal or night extras.
const startingFare = (destinationId: string): number => {
  const sedan = priceTrip({ pickupId: BASE_ID, destinationId, tripType: 'oneway' }).fares[0];
  return sedan.total;
};

const priceForVehicle = (quote: TripQuote, vehicleId: string): Fare => {
  const fare = quote.fares.find((f) => f.vehicleId === vehicleId);
  if (!fare) throw new ApiError(400, 'Unknown vehicle');
  return fare;
};

export { priceTrip, priceForVehicle, startingFare, roadKmBetween, istDateKey };
