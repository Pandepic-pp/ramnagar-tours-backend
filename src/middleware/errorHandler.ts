import { Request, Response, NextFunction } from 'express';
import env from '../config/env.js';
import ApiError from '../utils/ApiError.js';

const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({ success: false, message: err.message });
    return;
  }

  // Narrow to a shape that covers the common Mongoose and JWT error patterns
  const e = err as {
    name?: string;
    code?: number;
    message?: string;
    path?: string;
    value?: unknown;
    keyValue?: Record<string, unknown>;
    errors?: Record<string, { message: string }>;
  };

  if (e.name === 'ValidationError' && e.errors) {
    const message = Object.values(e.errors).map((v) => v.message).join(', ');
    res.status(400).json({ success: false, message });
    return;
  }

  if (e.code === 11000 && e.keyValue) {
    const field = Object.keys(e.keyValue)[0];
    res.status(409).json({ success: false, message: `${field} already in use` });
    return;
  }

  if (e.name === 'CastError') {
    res.status(400).json({ success: false, message: `Invalid ${e.path}: ${e.value}` });
    return;
  }

  if (e.name === 'JsonWebTokenError' || e.name === 'TokenExpiredError') {
    res.status(401).json({ success: false, message: 'Invalid or expired session' });
    return;
  }

  console.error('[error]', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    ...(env.nodeEnv === 'development' && { error: e.message }),
  });
};

export default errorHandler;
