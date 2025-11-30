import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { RegisterRequest, LoginRequest, AuthRequest } from '../types/index';
import { User } from '../models/user';
import { sendForgotPasswordOtp, sendOtp, verifyForgotPasswordOtp, verifyOtp } from '../services/otp.service';
import { OtpTooRecentError } from '../services/otp.service';
import mongoose from 'mongoose';
import { OtpType } from '../models/otp';

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
            await User.deleteOne({ username, isVerified: false});
        }

        // Assign random avatar from avatar1.svg to avatar8.svg
        const randomAvatarNumber = Math.floor(Math.random() * 8) + 1;
        const randomAvatar = `avatar${randomAvatarNumber}.svg`;

        const newUser = await User.create({
          username,
          email,
          password: hashedPassword,
          avatar: randomAvatar,
          isVerified: false,
        });

        try{
            await sendOtp(newUser);
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
            username: newUser.username,
            email: newUser.email,
          },
        });
    }
    catch(error: any){
        res.status(500).json({ 
        message: 'Server error during registration', 
        error: error.message });
    }

}

export const resendOtp = async (req:Request, res:Response) => {
  const {email, type} = req.body;
  if(type == OtpType.REGISTER){
  const user = await User.findOne({email, isVerified:false});
  if(!user){
    return res.status(200).json({ message: 'OTP sent if the user exists.' });
  }
  try{
      await sendOtp(user);
      return res.status(200).json({ message: 'OTP sent if the user exists.' });
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
  }
  else if (type == OtpType.FORGOT_PASSWORD){
    const user = await User.findOne({email, isVerified:true});

    if(!user){
      return res.status(200).json({message: "OTP send if the user exists"})
    }

    try {
      await sendForgotPasswordOtp(user);
      return res.status(200).json({message: "OTP sent if the user exists"})
    } catch (error: any) {
      console.error('Error sending forgot password OTP:', error);
      return res.status(500).json({message: "Internal server error"});
    }
  }
  else{
    return res.status(400).json({message: "Invalid Type"})
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
        avatar: user.avatar,
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

export const forgotPassword = async(req: Request,res: Response)=>{

  const {email} = req.body;

  const user = await User.findOne({email, isVerified:true});

  if(!user){
    return res.status(200).json({message: "OTP send if the user exists"})
  }

  try {
    await sendForgotPasswordOtp(user);
    return res.status(200).json({message: "OTP sent if the user exists"})
  } catch (error: any) {
    console.error('Error sending forgot password OTP:', error);
    return res.status(500).json({message: "Internal server error"});
  }
}


export const otpVerification = async (req: Request, res: Response) =>{

    const{email, otp} = req.body;
    if(await verifyOtp(email,otp)){
        const user = await User.findOne({ email });
        
        user!.isVerified = true;
        await user!.save();
        const token = jwt.sign(
          { userId: (user!._id as mongoose.Types.ObjectId).toString(), email: user!.email , username: user!.username},
          JWT_SECRET!,
          { expiresIn: '24h' }
        );
        res.status(200).json({
          message: 'OTP verification successful',
          token,
          user: {
            id: user!._id,
            username: user!.username,
            email: user!.email,
            elo: user!.elo,
            avatar: user!.avatar,
          },
        });
    }
    else{
        return res.status(401).json({ message: 'Invalid OTP' });
    }
    
}

export const forgotPasswordOtpVerification = async (req: Request, res: Response) =>{

    const{email, otp} = req.body;
    if(await verifyForgotPasswordOtp(email,otp)){
        const user = await User.findOne({ email });

        if (!user) {
          return res.status(404).json({ message: 'User not found' });
        }

        const token = jwt.sign(
          { userId: (user._id as mongoose.Types.ObjectId).toString(), email: user.email , username: user.username},
          JWT_SECRET!,
          { expiresIn: '10m' }
        );
        res.status(200).json({
          message: 'OTP verified successfully',
          forgotPasswordAccessToken: token,
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
            elo: user.elo,
            avatar: user.avatar,
          },
        });
    }
    else{
        return res.status(401).json({ message: 'Invalid OTP' });
    }
    
}

export const changePassword = async (req: AuthRequest, res: Response) => {
  try {
    const { newPassword } = req.body;
    
    const email = req.user?.email;

    if (!newPassword) {
      return res.status(400).json({ message: 'New password is required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;
    await user.save();

    res.status(200).json({ 
      message: 'Password changed successfully! You can now log in.' 
    });
  } catch (error: any) {
    console.error('Change password error:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
  }
};




