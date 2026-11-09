import { Request, Response } from 'express';
import { BASE_ID, locations, vehicles, rules } from '../config/catalog.js';
import { priceTrip, startingFare, QuoteInput } from '../services/pricing.service.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';

// Everything the booking UI needs to render itself. It changes only when the rate card does, so it is cacheable.
const getCatalog = asyncHandler(async (_req: Request, res: Response) => {
  const data = {
    baseId: BASE_ID,
    locations: locations.map((l) => ({
      id: l.id,
      name: l.name,
      region: l.region,
      kind: l.kind,
      lat: l.lat,
      lng: l.lng,
      blurb: l.blurb,
      popular: l.popular ?? false,
      // Route facts from our base, for the destination cards
      fromBase: l.id === BASE_ID ? null : { distanceKm: l.roadKm, durationMin: l.driveMin, startingFare: startingFare(l.id) },
    })),
    vehicles: vehicles.map((v) => ({
      id: v.id,
      name: v.name,
      models: v.models,
      seats: v.seats,
      bags: v.bags,
      oneWayPerKm: v.oneWayPerKm,
      roundTripPerKm: v.roundTripPerKm,
    })),
    rules: {
      gstPercent: rules.gstPercent,
      minLeadMinutes: rules.minLeadMinutes,
      maxNights: rules.maxNights,
      oneWayMinKm: rules.oneWayMinKm,
      outstationMinKmPerDay: rules.outstationMinKmPerDay,
      nightPickup: rules.nightPickup,
      peakSurchargePercent: rules.peakSurchargePercent,
      peakWindows: rules.peakWindows.map((w) => w.label),
    },
  };
  res.set('Cache-Control', 'public, max-age=300');
  res.json(new ApiResponse(200, data));
});

// Prices every vehicle for a trip in one call, so choosing a vehicle in the UI needs no further request
const quote = asyncHandler(async (req: Request, res: Response) => {
  res.json(new ApiResponse(200, priceTrip(req.body as QuoteInput)));
});

export { getCatalog, quote };
