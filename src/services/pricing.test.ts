import test from 'node:test';
import assert from 'node:assert/strict';
import { priceTrip, priceForVehicle, startingFare, roadKmBetween } from './pricing.service.js';
import { locations } from '../config/catalog.js';
import ApiError from '../utils/ApiError.js';

const sedanOf = (q: ReturnType<typeof priceTrip>) => priceForVehicle(q, 'sedan');
const line = (fare: ReturnType<typeof sedanOf>, code: string) => fare.lines.find((l) => l.code === code);
const sum = (fare: ReturnType<typeof sedanOf>) => fare.lines.reduce((s, l) => s + l.amount, 0);

test('one way under the minimum is billed at the minimum km', () => {
  const q = priceTrip({ pickupId: 'ramnagar', destinationId: 'nainital', tripType: 'oneway' });
  const f = sedanOf(q);
  assert.equal(q.distanceKm, 65);
  assert.equal(f.billableKm, 80);
  assert.equal(line(f, 'base')?.amount, 80 * 16);
  assert.equal(line(f, 'gst')?.amount, 64);
  assert.equal(f.total, 1340);
});

test('one way over the minimum is billed on actual km', () => {
  const f = sedanOf(priceTrip({ pickupId: 'ramnagar', destinationId: 'ranikhet', tripType: 'oneway' }));
  assert.equal(f.billableKm, 85);
  assert.equal(line(f, 'base')?.amount, 85 * 16);
});

test('every fare is internally consistent: lines add up to the total, total is a multiple of 10', () => {
  const dests = locations.filter((l) => l.id !== 'ramnagar');
  for (const d of dests) {
    for (const tripType of ['oneway', 'roundtrip'] as const) {
      const q = priceTrip({
        pickupId: 'ramnagar',
        destinationId: d.id,
        tripType,
        pickupAt: new Date('2026-12-01T04:30:00Z'),
        returnDate: tripType === 'roundtrip' ? '2026-12-03' : undefined,
      });
      for (const f of q.fares) {
        assert.equal(sum(f), f.total, `${d.id} ${tripType} ${f.vehicleId}`);
        assert.equal(f.total % 10, 0);
        assert.ok(f.total >= f.lines[0].amount);
      }
    }
  }
});

test('round trip uses the daily minimum, adds driver stay, and has no peak or night extras off-season', () => {
  const q = priceTrip({
    pickupId: 'ramnagar',
    destinationId: 'nainital',
    tripType: 'roundtrip',
    pickupAt: new Date('2026-12-01T04:30:00Z'), // 10:00 IST
    returnDate: '2026-12-02',
  });
  const f = sedanOf(q);
  assert.equal(q.days, 2);
  assert.equal(q.nights, 1);
  assert.equal(f.billableKm, 500);
  assert.equal(line(f, 'base')?.amount, 500 * 12);
  assert.equal(line(f, 'driver_stay')?.amount, 300);
  assert.equal(line(f, 'peak'), undefined);
  assert.equal(line(f, 'night_pickup'), undefined);
  assert.equal(f.total, 6620);
});

test('a short same-day round trip is a local package, not a 250 km outstation minimum', () => {
  const q = priceTrip({ pickupId: 'ramnagar', destinationId: 'corbett-bijrani', tripType: 'roundtrip', pickupAt: new Date('2026-12-01T00:00:00Z'), returnDate: '2026-12-01' });
  const f = sedanOf(q);
  assert.equal(q.days, 1);
  assert.equal(f.billableKm, 80);
});

test('round trip with no return date is a same-day trip', () => {
  const q = priceTrip({ pickupId: 'ramnagar', destinationId: 'nainital', tripType: 'roundtrip', pickupAt: new Date('2026-12-01T04:30:00Z') });
  assert.equal(q.nights, 0);
});

test('night pickup charge applies from 11 pm to before 4 am India time', () => {
  const at = (iso: string) => priceTrip({ pickupId: 'ramnagar', destinationId: 'nainital', tripType: 'oneway', pickupAt: new Date(iso) });
  // 2 am IST
  assert.equal(at('2026-11-30T20:30:00Z').nightPickup, true);
  // 11 pm IST
  assert.equal(at('2026-12-01T17:30:00Z').nightPickup, true);
  // 4:30 am IST: a safari start, no charge
  assert.equal(at('2026-12-01T23:00:00Z').nightPickup, false);
  // 3:59 am IST
  assert.equal(at('2026-12-01T22:29:00Z').nightPickup, true);
  assert.equal(line(sedanOf(at('2026-11-30T20:30:00Z')), 'night_pickup')?.amount, 250);
});

test('peak season adds 10% of the base fare, and the window wraps the new year', () => {
  const at = (iso: string) => priceTrip({ pickupId: 'ramnagar', destinationId: 'nainital', tripType: 'oneway', pickupAt: new Date(iso) });
  const june = at('2026-06-10T04:30:00Z');
  assert.equal(june.peak, 'Summer holidays');
  assert.equal(line(sedanOf(june), 'peak')?.amount, 128);
  assert.equal(sedanOf(june).total, 1480);
  assert.ok(at('2026-12-28T04:30:00Z').peak);
  assert.ok(at('2027-01-03T04:30:00Z').peak);
  assert.equal(at('2027-01-10T04:30:00Z').peak, null);
  assert.equal(at('2026-09-10T04:30:00Z').peak, null);
});

test('tolls and permits are passed through without GST', () => {
  const f = sedanOf(priceTrip({ pickupId: 'ramnagar', destinationId: 'delhi', tripType: 'oneway' }));
  assert.equal(line(f, 'base')?.amount, 250 * 16);
  assert.equal(line(f, 'tolls')?.amount, 420);
  assert.equal(line(f, 'permit')?.amount, 350);
  assert.equal(line(f, 'gst')?.amount, 200); // 5% of 4000 only
  assert.equal(f.total, 4970);
});

test('round trip doubles tolls', () => {
  const f = sedanOf(priceTrip({ pickupId: 'ramnagar', destinationId: 'haridwar', tripType: 'roundtrip', pickupAt: new Date('2026-12-01T04:30:00Z'), returnDate: '2026-12-01' }));
  assert.equal(line(f, 'tolls')?.amount, 300);
});

test('short local hops use the 30 km minimum and the vehicle minimum fare, not the 80 km outstation minimum', () => {
  const f = sedanOf(priceTrip({ pickupId: 'ramnagar', destinationId: 'ramnagar-station', tripType: 'oneway' }));
  assert.equal(f.billableKm, 30);
  assert.equal(line(f, 'base')?.amount, 600); // 30 km x 16 = 480, lifted to the sedan minimum fare
  const gate = sedanOf(priceTrip({ pickupId: 'ramnagar', destinationId: 'corbett-bijrani', tripType: 'oneway' }));
  assert.equal(gate.billableKm, 30);
  assert.equal(gate.total, 630); // 600 + 5% GST
});

test('passengers beyond seats mark a vehicle as not fitting', () => {
  const q = priceTrip({ pickupId: 'ramnagar', destinationId: 'nainital', tripType: 'oneway', passengers: 5 });
  assert.deepEqual(q.fares.map((f) => f.fits), [false, true, true, true]);
});

test('road distance between non-base places is symmetric and obeys the triangle inequality', () => {
  const a = locations.find((l) => l.id === 'nainital')!;
  const b = locations.find((l) => l.id === 'kainchi-dham')!;
  assert.equal(roadKmBetween(a, b), roadKmBetween(b, a));
  const d = roadKmBetween(a, b);
  assert.ok(d >= Math.abs(a.roadKm - b.roadKm));
  assert.ok(d <= a.roadKm + b.roadKm);
  // Nainital to Kainchi Dham is a short hop on the real road (about 17 km)
  assert.ok(d < 40, `got ${d}`);
});

test('starting fare matches a dateless sedan one-way quote', () => {
  assert.equal(startingFare('nainital'), 1340);
});

test('validation errors', () => {
  assert.throws(() => priceTrip({ pickupId: 'nowhere', destinationId: 'nainital', tripType: 'oneway' }), ApiError);
  assert.throws(() => priceTrip({ pickupId: 'nainital', destinationId: 'nainital', tripType: 'oneway' }), /different/);
  assert.throws(
    () => priceTrip({ pickupId: 'ramnagar', destinationId: 'nainital', tripType: 'roundtrip', pickupAt: new Date('2026-12-05T04:30:00Z'), returnDate: '2026-12-01' }),
    /before the pickup/
  );
  assert.throws(
    () => priceTrip({ pickupId: 'ramnagar', destinationId: 'nainital', tripType: 'roundtrip', pickupAt: new Date('2026-12-01T04:30:00Z'), returnDate: '2027-01-30' }),
    /at most/
  );
});

test('return date is read as an India date even when the pickup is just after midnight IST', () => {
  // 00:30 IST on 2 Dec is 19:00 UTC on 1 Dec. Returning on 2 Dec is the same day, not the next.
  const q = priceTrip({ pickupId: 'ramnagar', destinationId: 'nainital', tripType: 'roundtrip', pickupAt: new Date('2026-12-01T19:00:00Z'), returnDate: '2026-12-02' });
  assert.equal(q.nights, 0);
});
