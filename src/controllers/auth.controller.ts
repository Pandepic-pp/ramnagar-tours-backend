import { Request, Response } from 'express';
import env from '../config/env.js';
import { sendOtp, verifyOtp } from '../services/auth.service.js';
import { AuthRequest, SESSION_COOKIE, sessionCookieOptions } from '../middleware/auth.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';
import type { UserDocument } from '../models/User.js';

const sendOtpHandler = asyncHandler(async (req: Request, res: Response) => {
  const { phone } = req.body as { phone: string };
  const data = await sendOtp(phone);
  res.json(new ApiResponse(200, data, 'OTP sent'));
});

const verifyOtpHandler = asyncHandler(async (req: Request, res: Response) => {
  const { phone, otp } = req.body as { phone: string; otp: string };
  const { user, isNewUser, token } = await verifyOtp(phone, otp);

  res.cookie(SESSION_COOKIE, token, {
    ...sessionCookieOptions,
    maxAge: env.jwtExpiresInDays * 24 * 60 * 60 * 1000,
  });

  const status = isNewUser ? 201 : 200;
  res.status(status).json(
    new ApiResponse(status, {
      userId: user._id,
      phone: user.phone,
      name: user.name ?? null,
      isNewUser,
    }, isNewUser ? 'User registered' : 'Login successful')
  );
});

const toMe = (user: UserDocument) => ({
  userId: user._id,
  phone: user.phone,
  name: user.name ?? null,
  email: user.email ?? null,
  role: user.role,
});

const me = asyncHandler<AuthRequest>(async (req, res) => {
  res.json(new ApiResponse(200, toMe(req.user)));
});

// Who is signed in? Always 200: `data` is the user, or null for an anonymous visitor.
const session = asyncHandler(async (req: Request, res: Response) => {
  res.json(new ApiResponse(200, req.user ? toMe(req.user) : null));
});

const logout = asyncHandler(async (_req: Request, res: Response) => {
  res.clearCookie(SESSION_COOKIE, sessionCookieOptions);
  res.json(new ApiResponse(200, null, 'Logged out successfully'));
});

export { sendOtpHandler, verifyOtpHandler, me, session, logout };
