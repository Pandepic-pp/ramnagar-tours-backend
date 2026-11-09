import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import OtpSession from '../models/OtpSession.js';
import OtpAttempt from '../models/OtpAttempt.js';
import User, { UserDocument } from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { sendOtpSms } from './sms.service.js';

const OTP_EXPIRY_MS       = 5 * 60 * 1000;
const RESEND_COOLDOWN_SEC = 30;
const MAX_FAILED_ATTEMPTS = 5;
const BLOCK_DURATION_MS   = 15 * 60 * 1000;

export interface SendOtpResult {
  expiresAt: Date;
}

export interface VerifyOtpResult {
  user: UserDocument;
  isNewUser: boolean;
  token: string;
}

const normalizePhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return `+91${digits.slice(2)}`;
  if (digits.length === 10) return `+91${digits}`;
  throw new ApiError(400, 'Invalid phone number');
};

const hashOtp = (phone: string, otp: string): string =>
  crypto.createHmac('sha256', env.jwtSecret).update(`otp:${phone}:${otp}`).digest('hex');

const isDuplicateKeyError = (err: unknown): boolean => (err as { code?: number }).code === 11000;

// Clears an expired block, throws while one is still active
const assertNotBlocked = async (phone: string): Promise<void> => {
  const attempt = await OtpAttempt.findOne({ phone });
  if (!attempt?.blockedUntil) return;

  if (attempt.blockedUntil > new Date()) {
    const secsLeft = Math.ceil((attempt.blockedUntil.getTime() - Date.now()) / 1000);
    throw new ApiError(429, `Too many failed attempts. Try again in ${secsLeft} seconds.`);
  }

  await OtpAttempt.updateOne({ phone }, { failedAttempts: 0, blockedUntil: null });
};

const blockPhone = async (phone: string): Promise<void> => {
  await OtpAttempt.updateOne({ phone }, { blockedUntil: new Date(Date.now() + BLOCK_DURATION_MS) });
  await OtpSession.deleteOne({ phone });
};

const sendOtp = async (phone: string): Promise<SendOtpResult> => {
  const normalizedPhone = normalizePhone(phone);

  await assertNotBlocked(normalizedPhone);

  const otp = env.demoOtp || crypto.randomInt(100000, 1000000).toString();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MS);
  const cooldownCutoff = new Date(now.getTime() - RESEND_COOLDOWN_SEC * 1000);

  // Atomic cooldown: the filter only matches a session old enough to replace. If one exists but is
  // too recent, the upsert tries to insert a second doc for the phone and the unique index rejects it.
  try {
    await OtpSession.findOneAndUpdate(
      { phone: normalizedPhone, sentAt: { $lte: cooldownCutoff } },
      { $set: { otpHash: hashOtp(normalizedPhone, otp), sentAt: now, expiresAt } },
      { upsert: true }
    );
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err;
    const current = await OtpSession.findOne({ phone: normalizedPhone });
    const waitSecs = current
      ? Math.max(1, Math.ceil(RESEND_COOLDOWN_SEC - (Date.now() - current.sentAt.getTime()) / 1000))
      : RESEND_COOLDOWN_SEC;
    throw new ApiError(429, `Please wait ${waitSecs} seconds before requesting another OTP.`);
  }

  try {
    if (!env.demoOtp) await sendOtpSms(normalizedPhone.slice(3), otp);
  } catch (err) {
    // Don't leave a code the user never received holding the cooldown
    await OtpSession.deleteOne({ phone: normalizedPhone });
    throw err;
  }

  return { expiresAt };
};

const verifyOtp = async (phone: string, otp: string): Promise<VerifyOtpResult> => {
  const normalizedPhone = normalizePhone(phone);

  await assertNotBlocked(normalizedPhone);

  const hasLiveOtp = await OtpSession.exists({ phone: normalizedPhone, expiresAt: { $gt: new Date() } });
  if (!hasLiveOtp) {
    throw new ApiError(400, 'OTP expired or not found. Please request a new one.');
  }

  // Count the attempt *before* comparing so parallel guesses can't exceed the limit
  const attempt = await OtpAttempt.findOneAndUpdate(
    { phone: normalizedPhone },
    { $inc: { failedAttempts: 1 } },
    { upsert: true, new: true }
  );

  if (attempt.failedAttempts > MAX_FAILED_ATTEMPTS) {
    await blockPhone(normalizedPhone);
    throw new ApiError(429, 'Too many failed attempts. Please try again in 15 minutes.');
  }

  // Compare-and-consume in one step: a code can only ever be used once
  const consumed = await OtpSession.findOneAndDelete({
    phone: normalizedPhone,
    otpHash: hashOtp(normalizedPhone, otp),
    expiresAt: { $gt: new Date() },
  });

  if (!consumed) {
    if (attempt.failedAttempts >= MAX_FAILED_ATTEMPTS) {
      await blockPhone(normalizedPhone);
      throw new ApiError(429, 'Too many failed attempts. Phone blocked for 15 minutes.');
    }
    const remaining = MAX_FAILED_ATTEMPTS - attempt.failedAttempts;
    throw new ApiError(401, `Incorrect OTP. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`);
  }

  await OtpAttempt.updateOne({ phone: normalizedPhone }, { failedAttempts: 0, blockedUntil: null });

  let user = await User.findOne({ phone: normalizedPhone });
  const isNewUser = !user;

  if (!user) {
    user = await User.create({ phone: normalizedPhone, lastLoginAt: new Date() });
  } else {
    if (!user.isActive) throw new ApiError(403, 'This account has been disabled');
    user.lastLoginAt = new Date();
    await user.save();
  }

  const token = jwt.sign(
    { userId: user._id.toString() },
    env.jwtSecret,
    { expiresIn: `${env.jwtExpiresInDays}d` }
  );

  return { user, isNewUser, token };
};

export { sendOtp, verifyOtp };
