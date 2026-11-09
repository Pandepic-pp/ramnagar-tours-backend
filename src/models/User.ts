import mongoose, { Schema, HydratedDocument } from 'mongoose';

export interface IUser {
  phone: string; // E.164, e.g. +919876543210 — verified via OTP, so always trusted
  name?: string;
  email?: string;
  role: 'customer' | 'admin';
  isActive: boolean;
  lastLoginAt?: Date;
}

export type UserDocument = HydratedDocument<IUser>;

const userSchema = new Schema<IUser>(
  {
    phone:       { type: String, required: true, unique: true },
    name:        { type: String, trim: true },
    email:       { type: String, trim: true, lowercase: true },
    role:        { type: String, enum: ['customer', 'admin'], default: 'customer' },
    isActive:    { type: Boolean, default: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model<IUser>('User', userSchema);
