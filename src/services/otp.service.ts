import { sendVerificationEmail } from '../services/email.service';
import { IUser } from '../models/user';
import { otp, OtpType } from '../models/otp';

export class OtpTooRecentError extends Error {
  diffInSec: number;

  constructor(diffInSec: number) {
    super("OTP_TOO_RECENT");
    this.name = "OtpTooRecentError";
    this.diffInSec = diffInSec;
  }
}

const generateOtp = (): string => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

export const sendOtp = async (
    user:IUser
)=>{
    const randomotp = generateOtp();

    const existingOtp = await otp.findOne({ email: user.email , type: OtpType.REGISTER });

    if(existingOtp){
        const now = new Date();
        const diffInMs = now.getTime() - existingOtp.createdAt.getTime();

        if(diffInMs <= 30 * 1000){
            throw new OtpTooRecentError(30-diffInMs/1000);
        }
        else{
            otp.deleteOne({ email: user.email })
        }
    }

    const newOtp = await otp.create({
        email:user.email,
        type:OtpType.REGISTER,
        otp:randomotp,
    })

    sendVerificationEmail(user.email, user.username, randomotp);
}

export const sendForgotPasswordOtp = async (
    user:IUser
)=>{
    const randomotp = generateOtp();

    const existingOtp = await otp.findOne({ email: user.email , type: OtpType.FORGOT_PASSWORD });

    if(existingOtp){
        const now = new Date();
        const diffInMs = now.getTime() - existingOtp.createdAt.getTime();

        if(diffInMs <= 30 * 1000){
            throw new OtpTooRecentError(30-diffInMs/1000);
        }
        else{
            otp.deleteOne({ email: user.email })
        }
    }

    const newOtp = await otp.create({
        email:user.email,
        type:OtpType.FORGOT_PASSWORD,
        otp:randomotp,
    })

    sendVerificationEmail(user.email, user.username, randomotp);
}


export const verifyOtp = async (
    email:string,
    vOtp:string
) => {
    const existingOtp = await otp.findOne({ email, otp:vOtp, type: OtpType.REGISTER });
    if(existingOtp){
        const now = new Date();
        const diffInMs = now.getTime() - existingOtp.createdAt.getTime();

        if(diffInMs > 5*60 * 1000){
            return false;
        }
        else{
            return true;
        }

    }
    return false;
}

export const verifyForgotPasswordOtp = async (
    email:string,
    vOtp:string
) => {
    const existingOtp = await otp.findOne({ email, otp:vOtp, type: OtpType.FORGOT_PASSWORD });
    if(existingOtp){
        const now = new Date();
        const diffInMs = now.getTime() - existingOtp.createdAt.getTime();

        if(diffInMs > 5*60 * 1000){
            return false;
        }
        else{
            return true;
        }

    }
    return false;
}
