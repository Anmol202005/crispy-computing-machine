import mongoose, { Schema, Document } from 'mongoose';

export interface IOtp extends Document{
  email: string;
  otp: string;
  createdAt: Date;
}


const otpSchema = new Schema<IOtp>({
  
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
    index: true,
  },
  otp: {
    type: String,
    required: [true, 'OTP is required'],
    length: 6,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  }
});

otpSchema.index({ createdAt: 1 }, { expireAfterSeconds: 5*60*1000 });
otpSchema.index({ email: 1 });

export const otp = mongoose.model<IOtp>('Otp', otpSchema);
