import mongoose, { Schema, HydratedDocument } from 'mongoose';

export interface IOtpSession {
  phone: string;
  otpHash: string; // HMAC of phone + otp — the plaintext OTP is never stored
  sentAt: Date;    // drives the resend cooldown
  expiresAt: Date;
}

export type OtpSessionDocument = HydratedDocument<IOtpSession>;

// One active OTP per phone: a resend overwrites the previous code, and the unique index
// on `phone` is what makes the resend-cooldown check atomic (see auth.service.ts).
const otpSessionSchema = new Schema<IOtpSession>({
  phone:     { type: String, required: true, unique: true },
  otpHash:   { type: String, required: true },
  sentAt:    { type: Date, required: true },
  // expires: 0 creates a TTL index — MongoDB auto-deletes when expiresAt is reached
  expiresAt: { type: Date, required: true, expires: 0 },
});

export default mongoose.model<IOtpSession>('OtpSession', otpSessionSchema);
