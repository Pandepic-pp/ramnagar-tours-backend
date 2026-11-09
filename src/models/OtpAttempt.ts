import mongoose, { Schema, HydratedDocument } from 'mongoose';

export interface IOtpAttempt {
  phone: string;
  failedAttempts: number;
  blockedUntil?: Date | null;
}

export type OtpAttemptDocument = HydratedDocument<IOtpAttempt>;

// One document per phone — tracks failed OTP attempts and temporary blocks
const otpAttemptSchema = new Schema<IOtpAttempt>({
  phone:          { type: String, required: true, unique: true },
  failedAttempts: { type: Number, default: 0 },
  blockedUntil:   { type: Date, default: null },
});

export default mongoose.model<IOtpAttempt>('OtpAttempt', otpAttemptSchema);
