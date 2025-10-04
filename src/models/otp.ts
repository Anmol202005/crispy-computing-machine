import mongoose, { Schema, Document } from 'mongoose';

export enum OtpType {
  REGISTER = 'register',
  FORGOT_PASSWORD = 'forgot_password'
}


export interface IOtp extends Document{
  email: string;
  otp: string;
  type:OtpType;
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
  type: {
    type: String,
    required: [true, 'OTP type is required'],
    enum: Object.values(OtpType),
  },
  createdAt: {
    type: Date,
    default: Date.now,
  }
});

otpSchema.index({ createdAt: 1 }, { expireAfterSeconds: 5*60 });
otpSchema.index({ email: 1 , type: 1});

export const otp = mongoose.model<IOtp>('Otp', otpSchema);
