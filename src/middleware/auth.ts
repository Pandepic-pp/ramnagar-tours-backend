import { Request, CookieOptions } from 'express';
import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import User, { UserDocument } from '../models/User.js';

// Use this type in authenticated controllers for non-optional req.user
export interface AuthRequest extends Request {
  user: UserDocument;
}

// The session JWT lives in an httpOnly cookie so page scripts (and any XSS) can never read it.
// SameSite=Lax assumes the site and API share a registrable domain (e.g. www.example.com + api.example.com).
export const SESSION_COOKIE = 'tours_session';

export const sessionCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite: 'lax',
  path: '/',
};

const verifyToken = asyncHandler(async (req, _res, next) => {
  const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
  if (!token) throw new ApiError(401, 'Not signed in');

  let decoded: { userId: string };
  try {
    decoded = jwt.verify(token, env.jwtSecret) as { userId: string };
  } catch {
    throw new ApiError(401, 'Invalid or expired session');
  }

  const user = await User.findOne({ _id: decoded.userId, isActive: true });
  if (!user) throw new ApiError(401, 'User not found');

  req.user = user;
  next();
});

// Like verifyToken, but a missing or invalid session just means "not signed in" instead of an error.
// The site calls this on every page load, so anonymous visitors must not see a 401.
const optionalAuth = asyncHandler(async (req, _res, next) => {
  const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
  if (token) {
    try {
      const decoded = jwt.verify(token, env.jwtSecret) as { userId: string };
      const user = await User.findOne({ _id: decoded.userId, isActive: true });
      if (user) req.user = user;
    } catch {
      // expired or forged: treat as signed out
    }
  }
  next();
});

// Use after verifyToken
const requireAdmin = asyncHandler(async (req, _res, next) => {
  if (req.user?.role !== 'admin') throw new ApiError(403, 'Admin access required');
  next();
});

export { verifyToken, optionalAuth, requireAdmin };
