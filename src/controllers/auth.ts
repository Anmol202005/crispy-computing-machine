import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { RegisterRequest, LoginRequest, AuthRequest } from '../types/index';
import { User } from '../models/user';
import { sendOtp, verifyOtp } from '../services/otp.service';
import { OtpTooRecentError } from '../services/otp.service';
import mongoose from 'mongoose';

const JWT_SECRET = process.env.JWT_SECRET;

export const registerUser = async(
    req: Request,
    res: Response
)=>{
    try{
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        const existingEmail = await User.findOne({ email, isVerified: true });
        const existingUsername = await User.findOne({ username, isVerified: true});
        if (existingEmail) {
          return res.status(400).json({ message: 'Email already exists' });
        }
        if (existingUsername) {
          return res.status(400).json({ message: 'Username already exists' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        if(await User.findOne({ username, isVerified: false})){
            User.deleteOne({ username, isVerified: false});
        }
        const newUser = await User.create({
          username,
          email,
          password: hashedPassword,
          isVerified: false,
        });

        try{
            sendOtp(newUser);
        }catch(error:any){
            if(error instanceof OtpTooRecentError) {
                const diffInSec = error.diffInSec;
                res.status(400).json({ 
                message: `Too many recent requests. Try after ${diffInSec} seconds`
                });
            }
            else{
                res.status(500).json({ 
                message: 'Internal Server Error', 
                error:error.info
                });
            }
            
        }

        res.status(201).json({
          message: 'Registration successful! Please check your email for OTP.',
          user: {
            id: newUser._id,
            username: newUser.username,
            email: newUser.email,
            elo: newUser.elo,
          },
        });
    }
    catch(error: any){
        res.status(500).json({ 
        message: 'Server error during registration', 
        error: error.message });
    }

}

export const login = async (req: Request, res: Response) => {
  try {
    
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.isVerified) {
      return res.status(403).json({ 
        message: 'Please verify your email before logging in. Check your inbox for OTP.' 
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: (user._id as mongoose.Types.ObjectId).toString(), email: user.email , username: user.username},
      JWT_SECRET!,
      { expiresIn: '24h' }
    );

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        elo: user.elo,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ 
      message: 'Server error during login', 
      error: error.message 
    });
  }
};

export const otpVerification = async (req: Request, res: Response) =>{

    const{email, vOtp} = req.body;
    if(await verifyOtp(email,vOtp)){
        const user = await User.findOne({ email });
        
        user!.isVerified = true;
        user!.save;
        const token = jwt.sign(
          { userId: (user!._id as mongoose.Types.ObjectId).toString(), email: user!.email , username: user!.username},
          JWT_SECRET!,
          { expiresIn: '24h' }
        );
        res.status(200).json({
          message: 'Login successful',
          token,
          user: {
            id: user!._id,
            username: user!.username,
            email: user!.email,
            elo: user!.elo,
          },
        });
    }
    else{
        return res.status(401).json({ message: 'Invalid OTP' });
    }
    
}


