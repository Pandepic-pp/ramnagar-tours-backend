import mongoose, { Schema, HydratedDocument } from 'mongoose';

export const BOOKING_STATUSES = ['requested', 'assigned', 'completed', 'cancelled'] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

// What the customer asked for, in catalogue terms. Absent on legacy free-text bookings.
export interface IBookingTrip {
  pickupId: string;
  destinationId: string;
  vehicleId: string;
  tripType: 'oneway' | 'roundtrip';
  returnDate?: string; // YYYY-MM-DD, India date
  distanceKm: number;
  durationMin: number;
  days: number;
}

// Price snapshot taken at booking time. Rate-card changes later must never rewrite history.
export interface IBookingFare {
  lines: { code: string; label: string; detail?: string; amount: number; group: string }[];
  total: number;
}

export interface IBooking {
  reference: string; // human-friendly, e.g. RT-20261109-K7QX
  userId: mongoose.Types.ObjectId;
  // Snapshots taken at booking time so history stays stable if the profile changes later
  contactName: string;
  contactPhone: string;
  pickup: string;
  destination: string;
  pickupAt: Date;
  passengers: number;
  notes?: string;
  status: BookingStatus;
  driver?: { name: string; phone: string };
  vehicle?: { model: string; number: string };
  assignedAt?: Date;
  completedAt?: Date;
  trip?: IBookingTrip;
  fare?: IBookingFare;
  createdAt?: Date; // set by mongoose timestamps
}

export type BookingDocument = HydratedDocument<IBooking>;

const bookingSchema = new Schema<IBooking>(
  {
    reference:    { type: String, required: true, unique: true },
    userId:       { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    contactName:  { type: String, required: true, trim: true },
    contactPhone: { type: String, required: true },
    pickup:       { type: String, required: true, trim: true },
    destination:  { type: String, required: true, trim: true },
    pickupAt:     { type: Date, required: true, index: true },
    passengers:   { type: Number, required: true, min: 1, max: 12 },
    notes:        { type: String, trim: true },
    status:       { type: String, enum: BOOKING_STATUSES, default: 'requested', index: true },
    driver:       { name: { type: String, trim: true }, phone: { type: String, trim: true } },
    vehicle:      { model: { type: String, trim: true }, number: { type: String, trim: true } },
    assignedAt:   { type: Date },
    completedAt:  { type: Date },
    trip: {
      type: new Schema<IBookingTrip>(
        {
          pickupId:      { type: String, required: true },
          destinationId: { type: String, required: true },
          vehicleId:     { type: String, required: true },
          tripType:      { type: String, enum: ['oneway', 'roundtrip'], required: true },
          returnDate:    { type: String },
          distanceKm:    { type: Number, required: true },
          durationMin:   { type: Number, required: true },
          days:          { type: Number, required: true },
        },
        { _id: false }
      ),
    },
    fare: {
      type: new Schema<IBookingFare>(
        {
          lines: [{ _id: false, code: String, label: String, detail: String, amount: Number, group: String }],
          total: { type: Number, required: true },
        },
        { _id: false }
      ),
    },
  },
  { timestamps: true }
);

export default mongoose.model<IBooking>('Booking', bookingSchema);
