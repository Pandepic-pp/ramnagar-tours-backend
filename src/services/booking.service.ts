import crypto from 'crypto';
import Booking, { BookingDocument, BookingStatus, BOOKING_STATUSES, IBooking } from '../models/Booking.js';
import { UserDocument } from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { vehicles, rules } from '../config/catalog.js';
import { priceTrip, priceForVehicle, TripType } from './pricing.service.js';

const MIN_LEAD_MS = rules.minLeadMinutes * 60 * 1000; // at least 30 minutes ahead
const MAX_LEAD_MS = 365 * 24 * 60 * 60 * 1000; // at most a year ahead
const MAX_OPEN_BOOKINGS = 5;                   // per user — keeps the admin board free of spam
const OPEN: BookingStatus[] = ['requested', 'assigned'];

export interface CreateBookingInput {
  // Free text (legacy) or derived from the catalogue ids below
  pickup?: string;
  destination?: string;
  pickupAt: Date;
  passengers: number;
  name?: string;
  notes?: string;
  // Catalogue booking: the server prices it
  pickupId?: string;
  destinationId?: string;
  vehicle?: string;
  tripType?: TripType;
  returnDate?: string;
  quotedTotal?: number;
}

export interface AssignBookingInput {
  driverName: string;
  driverPhone: string;
  vehicleModel: string;
  vehicleNumber: string;
}

const isDuplicateKeyError = (err: unknown): boolean => (err as { code?: number }).code === 11000;

// RT-YYYYMMDD-XXXX, drawn from an alphabet without look-alike characters (0/O, 1/I)
const makeReference = (): string => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const suffix = Array.from({ length: 4 }, () => alphabet[crypto.randomInt(alphabet.length)]).join('');
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `RT-${date}-${suffix}`;
};

const createBooking = async (user: UserDocument, input: CreateBookingInput): Promise<BookingDocument> => {
  const leadMs = input.pickupAt.getTime() - Date.now();
  if (leadMs < MIN_LEAD_MS) throw new ApiError(400, 'Pickup time must be at least 30 minutes from now');
  if (leadMs > MAX_LEAD_MS) throw new ApiError(400, 'Pickup time must be within the next year');

  const contactName = input.name ?? user.name;
  if (!contactName) throw new ApiError(400, 'Please tell us your name');

  // Price on the server, from the same engine as the quote endpoint. The client's number is only a price lock.
  let pricing: Pick<IBooking, 'trip' | 'fare'> = {};
  let pickupText = input.pickup;
  let destinationText = input.destination;

  if (input.pickupId && input.destinationId && input.vehicle) {
    const quote = priceTrip({
      pickupId: input.pickupId,
      destinationId: input.destinationId,
      tripType: input.tripType ?? 'oneway',
      pickupAt: input.pickupAt,
      returnDate: input.returnDate,
      passengers: input.passengers,
    });
    const fare = priceForVehicle(quote, input.vehicle);
    if (!fare.fits) {
      const seats = vehicles.find((v) => v.id === input.vehicle)?.seats;
      throw new ApiError(400, `This vehicle seats ${seats}. Please choose a larger one for ${input.passengers} passengers.`);
    }
    if (input.quotedTotal !== undefined && input.quotedTotal !== fare.total) {
      throw new ApiError(409, 'The fare has changed since you last looked. Please review the new price and confirm again.');
    }

    pickupText = quote.pickup.name;
    destinationText = quote.destination.name;
    pricing = {
      trip: {
        pickupId: input.pickupId,
        destinationId: input.destinationId,
        vehicleId: input.vehicle,
        tripType: quote.tripType,
        returnDate: quote.tripType === 'roundtrip' ? input.returnDate : undefined,
        distanceKm: quote.distanceKm,
        durationMin: quote.durationMin,
        days: quote.days,
      },
      fare: { lines: fare.lines, total: fare.total },
    };
  }

  if (!pickupText || !destinationText) throw new ApiError(400, 'Pickup and destination are required');

  const open = await Booking.countDocuments({ userId: user._id, status: { $in: OPEN } });
  if (open >= MAX_OPEN_BOOKINGS) {
    throw new ApiError(429, 'You already have several open bookings. Please cancel one or wait for it to complete.');
  }

  if (!user.name) {
    user.name = contactName;
    await user.save();
  }

  // The reference is unique-indexed; on the (very unlikely) collision just draw another
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await Booking.create({
        reference: makeReference(),
        userId: user._id,
        contactName,
        contactPhone: user.phone,
        pickup: pickupText,
        destination: destinationText,
        pickupAt: input.pickupAt,
        passengers: input.passengers,
        notes: input.notes || undefined,
        ...pricing,
      });
    } catch (err) {
      if (!isDuplicateKeyError(err)) throw err;
    }
  }
  throw new ApiError(500, 'Could not create the booking. Please try again.');
};

const listMyBookings = (user: UserDocument): Promise<BookingDocument[]> =>
  Booking.find({ userId: user._id }).sort({ pickupAt: -1 }).limit(50);

const cancelMyBooking = async (user: UserDocument, id: string): Promise<BookingDocument> => {
  const booking = await Booking.findOneAndUpdate(
    { _id: id, userId: user._id, status: { $in: OPEN } },
    { status: 'cancelled' },
    { new: true }
  );
  if (!booking) throw new ApiError(404, 'No open booking found to cancel');
  return booking;
};

// ---- admin (control room) ----

// No status = open bookings. "all" = everything. Open work is soonest-first; history is newest-first.
const listBookingsForAdmin = (status?: string): Promise<BookingDocument[]> => {
  if (status && status !== 'all' && !(BOOKING_STATUSES as readonly string[]).includes(status)) {
    throw new ApiError(400, `status must be all or one of: ${BOOKING_STATUSES.join(', ')}`);
  }
  const filter = status === 'all' ? {} : status ? { status } : { status: { $in: OPEN } };
  const isHistory = status === 'all' || status === 'completed' || status === 'cancelled';
  return Booking.find(filter).sort({ pickupAt: isHistory ? -1 : 1 }).limit(200);
};

// Only a booking that has a driver can be completed
const completeBooking = async (id: string): Promise<BookingDocument> => {
  const booking = await Booking.findOneAndUpdate(
    { _id: id, status: 'assigned' },
    { status: 'completed', completedAt: new Date() },
    { new: true }
  );
  if (!booking) throw new ApiError(404, 'No assigned booking found to complete');
  return booking;
};

const assignBooking = async (id: string, input: AssignBookingInput): Promise<BookingDocument> => {
  const booking = await Booking.findOneAndUpdate(
    { _id: id, status: { $in: OPEN } },
    {
      status: 'assigned',
      assignedAt: new Date(),
      driver: { name: input.driverName, phone: input.driverPhone },
      vehicle: { model: input.vehicleModel, number: input.vehicleNumber.toUpperCase() },
    },
    { new: true }
  );
  if (!booking) throw new ApiError(404, 'No open booking found to assign');
  return booking;
};

export { createBooking, listMyBookings, cancelMyBooking, listBookingsForAdmin, assignBooking, completeBooking };
