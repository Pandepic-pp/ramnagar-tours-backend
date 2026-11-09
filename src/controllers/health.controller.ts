import { Request, Response } from 'express';
import mongoose from 'mongoose';
import asyncHandler from '../utils/asyncHandler.js';

// A real health check: the process being up is not enough, the database has to answer too.
const health = asyncHandler(async (_req: Request, res: Response) => {
  let db: 'connected' | 'disconnected' = 'disconnected';
  try {
    if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
      await mongoose.connection.db.admin().ping();
      db = 'connected';
    }
  } catch {
    // leave as disconnected
  }

  const ok = db === 'connected';
  res.status(ok ? 200 : 503).json({
    status: ok ? 'ok' : 'degraded',
    db,
    uptimeSec: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

export { health };
