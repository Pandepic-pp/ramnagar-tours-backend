import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import {
  createBooking,
  listMyBookings,
  cancelMyBooking,
  listBookingsForAdmin,
  assignBooking,
  completeBooking,
  CreateBookingInput,
  AssignBookingInput,
} from '../services/booking.service.js';
import { BookingDocument } from '../models/Booking.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';

// Public shape of a booking — drivers' details only show once the admin has assigned one
const toDto = (b: BookingDocument) => ({
  id: b._id,
  reference: b.reference,
  contactName: b.contactName,
  contactPhone: b.contactPhone,
  pickup: b.pickup,
  destination: b.destination,
  pickupAt: b.pickupAt,
  passengers: b.passengers,
  notes: b.notes ?? null,
  status: b.status,
  driver: b.driver?.name ? { name: b.driver.name, phone: b.driver.phone } : null,
  vehicle: b.vehicle?.model ? { model: b.vehicle.model, number: b.vehicle.number } : null,
  createdAt: b.createdAt,
  completedAt: b.completedAt ?? null,
  // Present for catalogue bookings, null for legacy free-text ones
  trip: b.trip
    ? {
        pickupId: b.trip.pickupId,
        destinationId: b.trip.destinationId,
        vehicleId: b.trip.vehicleId,
        tripType: b.trip.tripType,
        returnDate: b.trip.returnDate ?? null,
        distanceKm: b.trip.distanceKm,
        durationMin: b.trip.durationMin,
        days: b.trip.days,
      }
    : null,
  fare: b.fare ? { lines: b.fare.lines, total: b.fare.total } : null,
});

const create = asyncHandler<AuthRequest>(async (req, res: Response) => {
  const booking = await createBooking(req.user, req.body as CreateBookingInput);
  res.status(201).json(new ApiResponse(201, toDto(booking), 'Booking requested'));
});

const listMine = asyncHandler<AuthRequest>(async (req, res: Response) => {
  const bookings = await listMyBookings(req.user);
  res.json(new ApiResponse(200, bookings.map(toDto)));
});

const cancel = asyncHandler<AuthRequest>(async (req, res: Response) => {
  const booking = await cancelMyBooking(req.user, req.params.id);
  res.json(new ApiResponse(200, toDto(booking), 'Booking cancelled'));
});

const adminList = asyncHandler<AuthRequest>(async (req, res: Response) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const bookings = await listBookingsForAdmin(status);
  res.json(new ApiResponse(200, bookings.map(toDto)));
});

const adminAssign = asyncHandler<AuthRequest>(async (req, res: Response) => {
  const booking = await assignBooking(req.params.id, req.body as AssignBookingInput);
  res.json(new ApiResponse(200, toDto(booking), 'Driver and car assigned'));
});

const adminComplete = asyncHandler<AuthRequest>(async (req, res: Response) => {
  const booking = await completeBooking(req.params.id);
  res.json(new ApiResponse(200, toDto(booking), 'Booking marked completed'));
});

export { create, listMine, cancel, adminList, adminAssign, adminComplete };
