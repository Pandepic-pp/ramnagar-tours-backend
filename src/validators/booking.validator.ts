import Joi from 'joi';
import { locations, vehicles } from '../config/catalog.js';

const place = Joi.string().trim().min(2).max(120);
const locationId = Joi.string().valid(...locations.map((l) => l.id)).messages({ 'any.only': 'Unknown place. Please choose from the list.' });
const vehicleId = Joi.string().valid(...vehicles.map((v) => v.id)).messages({ 'any.only': 'Unknown vehicle. Please choose from the list.' });
const indiaDate = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).messages({ 'string.pattern.base': 'returnDate must be YYYY-MM-DD' });

// Fields shared by a price quote and a booking, so the two can never disagree about what a trip is
const tripFields = {
  pickupId: locationId,
  destinationId: locationId,
  tripType: Joi.string().valid('oneway', 'roundtrip').default('oneway'),
  // ISO 8601 with offset, e.g. 2026-12-01T06:30:00+05:30 — the site always sends India time
  pickupAt: Joi.date().iso().required(),
  returnDate: indiaDate,
  passengers: Joi.number().integer().min(1).max(12).default(1),
};

const quoteSchema = Joi.object({
  ...tripFields,
  pickupId: locationId.required(),
  destinationId: locationId.required(),
  // A quote can be asked for before the customer has picked a time, but then date-based rules are skipped
  pickupAt: Joi.date().iso(),
});

// Two shapes are accepted:
//  - catalogue booking: pickupId + destinationId + vehicle. The server prices it and stores the fare.
//  - legacy free-text booking: pickup + destination as text. No fare. Kept so the older site keeps working.
const createBookingSchema = Joi.object({
  ...tripFields,
  pickup: place,
  destination: place,
  vehicle: vehicleId,
  // The total the customer saw. If the server's price differs (rates changed meanwhile), the booking is refused.
  quotedTotal: Joi.number().integer().min(0),
  name: Joi.string().trim().min(2).max(60),
  notes: Joi.string().trim().max(300).allow(''),
})
  .or('pickup', 'pickupId')
  .or('destination', 'destinationId')
  .with('pickupId', ['destinationId', 'vehicle'])
  .with('destinationId', ['pickupId', 'vehicle']);

const assignBookingSchema = Joi.object({
  driverName: Joi.string().trim().min(2).max(60).required(),
  driverPhone: Joi.string().trim().pattern(/^(\+91|91)?[6-9]\d{9}$/).required()
    .messages({ 'string.pattern.base': 'driverPhone must be a valid Indian mobile number' }),
  vehicleModel: Joi.string().trim().min(2).max(60).required(),
  vehicleNumber: Joi.string().trim().min(4).max(20).required(),
});

export { quoteSchema, createBookingSchema, assignBookingSchema };
