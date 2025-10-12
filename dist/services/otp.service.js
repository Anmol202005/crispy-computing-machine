"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyForgotPasswordOtp = exports.verifyOtp = exports.sendForgotPasswordOtp = exports.sendOtp = exports.OtpTooRecentError = void 0;
const email_service_1 = require("../services/email.service");
const otp_1 = require("../models/otp");
class OtpTooRecentError extends Error {
    constructor(diffInSec) {
        super("OTP_TOO_RECENT");
        this.name = "OtpTooRecentError";
        this.diffInSec = diffInSec;
    }
}
exports.OtpTooRecentError = OtpTooRecentError;
const generateOtp = () => {
    return Math.floor(1000 + Math.random() * 9000).toString();
};
const sendOtp = async (user) => {
    const randomotp = generateOtp();
    const existingOtp = await otp_1.otp.findOne({ email: user.email, type: otp_1.OtpType.REGISTER });
    if (existingOtp) {
        const now = new Date();
        const diffInMs = now.getTime() - existingOtp.createdAt.getTime();
        if (diffInMs <= 30 * 1000) {
            throw new OtpTooRecentError(30 - diffInMs / 1000);
        }
        else {
            await otp_1.otp.deleteOne({ email: user.email });
        }
    }
    const newOtp = await otp_1.otp.create({
        email: user.email,
        type: otp_1.OtpType.REGISTER,
        otp: randomotp,
    });
    (0, email_service_1.sendVerificationEmail)(user.email, user.username, randomotp);
};
exports.sendOtp = sendOtp;
const sendForgotPasswordOtp = async (user) => {
    const randomotp = generateOtp();
    const existingOtp = await otp_1.otp.findOne({ email: user.email, type: otp_1.OtpType.FORGOT_PASSWORD });
    if (existingOtp) {
        const now = new Date();
        const diffInMs = now.getTime() - existingOtp.createdAt.getTime();
        if (diffInMs <= 30 * 1000) {
            throw new OtpTooRecentError(30 - diffInMs / 1000);
        }
        else {
            otp_1.otp.deleteOne({ email: user.email });
        }
    }
    const newOtp = await otp_1.otp.create({
        email: user.email,
        type: otp_1.OtpType.FORGOT_PASSWORD,
        otp: randomotp,
    });
    (0, email_service_1.sendVerificationEmail)(user.email, user.username, randomotp);
};
exports.sendForgotPasswordOtp = sendForgotPasswordOtp;
const verifyOtp = async (email, vOtp) => {
    const existingOtp = await otp_1.otp.findOne({ email, otp: vOtp, type: otp_1.OtpType.REGISTER });
    console.log(existingOtp);
    console.log(email, vOtp);
    if (existingOtp) {
        const now = new Date();
        const diffInMs = now.getTime() - existingOtp.createdAt.getTime();
        if (diffInMs > 5 * 60 * 1000) {
            return false;
        }
        else {
            return true;
        }
    }
    return false;
};
exports.verifyOtp = verifyOtp;
const verifyForgotPasswordOtp = async (email, vOtp) => {
    const existingOtp = await otp_1.otp.findOne({ email, otp: vOtp, type: otp_1.OtpType.FORGOT_PASSWORD });
    if (existingOtp) {
        const now = new Date();
        const diffInMs = now.getTime() - existingOtp.createdAt.getTime();
        if (diffInMs > 5 * 60 * 1000) {
            return false;
        }
        else {
            return true;
        }
    }
    return false;
};
exports.verifyForgotPasswordOtp = verifyForgotPasswordOtp;
