"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.changePassword = exports.forgotPasswordOtpVerification = exports.otpVerification = exports.forgotPassword = exports.login = exports.resendOtp = exports.registerUser = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const user_1 = require("../models/user");
const otp_service_1 = require("../services/otp.service");
const otp_service_2 = require("../services/otp.service");
const otp_1 = require("../models/otp");
const JWT_SECRET = process.env.JWT_SECRET;
const registerUser = async (req, res) => {
    try {
        const { username, email, password } = req.body;
        if (!username || !email || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }
        const existingEmail = await user_1.User.findOne({ email, isVerified: true });
        const existingUsername = await user_1.User.findOne({ username, isVerified: true });
        if (existingEmail) {
            return res.status(400).json({ message: 'Email already exists' });
        }
        if (existingUsername) {
            return res.status(400).json({ message: 'Username already exists' });
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        if (await user_1.User.findOne({ username, isVerified: false })) {
            user_1.User.deleteOne({ username, isVerified: false });
        }
        const newUser = await user_1.User.create({
            username,
            email,
            password: hashedPassword,
            isVerified: false,
        });
        try {
            await (0, otp_service_1.sendOtp)(newUser);
        }
        catch (error) {
            if (error instanceof otp_service_2.OtpTooRecentError) {
                const diffInSec = error.diffInSec;
                res.status(400).json({
                    message: `Too many recent requests. Try after ${diffInSec} seconds`
                });
            }
            else {
                res.status(500).json({
                    message: 'Internal Server Error',
                    error: error.info
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
    catch (error) {
        res.status(500).json({
            message: 'Server error during registration',
            error: error.message
        });
    }
};
exports.registerUser = registerUser;
const resendOtp = async (req, res) => {
    const { email, type } = req.body;
    if (type == otp_1.OtpType.REGISTER) {
        const user = await user_1.User.findOne({ email, isVerified: false });
        if (!user) {
            return res.status(200).json({ message: 'OTP sent if the user exists.' });
        }
        try {
            (0, otp_service_1.sendOtp)(user);
            return res.status(200).json({ message: 'OTP sent if the user exists.' });
        }
        catch (error) {
            if (error instanceof otp_service_2.OtpTooRecentError) {
                const diffInSec = error.diffInSec;
                res.status(400).json({
                    message: `Too many recent requests. Try after ${diffInSec} seconds`
                });
            }
            else {
                res.status(500).json({
                    message: 'Internal Server Error',
                    error: error.info
                });
            }
        }
    }
    else if (type == otp_1.OtpType.FORGOT_PASSWORD) {
        const user = await user_1.User.findOne({ email, isVerified: true });
        if (!user) {
            return res.status(200).json({ message: "OTP send if the user exists" });
        }
        (0, otp_service_1.sendForgotPasswordOtp)(user);
        return res.status(200).json({ message: "OTP send if the user exists" });
    }
    else {
        return res.status(400).json({ message: "Invalid Type" });
    }
};
exports.resendOtp = resendOtp;
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }
        const user = await user_1.User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        if (!user.isVerified) {
            return res.status(403).json({
                message: 'Please verify your email before logging in. Check your inbox for OTP.'
            });
        }
        const isPasswordValid = await bcryptjs_1.default.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const token = jsonwebtoken_1.default.sign({ userId: user._id.toString(), email: user.email, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
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
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            message: 'Server error during login',
            error: error.message
        });
    }
};
exports.login = login;
const forgotPassword = async (req, res) => {
    const { email } = req.body;
    const user = await user_1.User.findOne({ email, isVerified: true });
    if (!user) {
        return res.status(200).json({ message: "OTP send if the user exists" });
    }
    (0, otp_service_1.sendForgotPasswordOtp)(user);
    return res.status(200).json({ message: "OTP send if the user exists" });
};
exports.forgotPassword = forgotPassword;
const otpVerification = async (req, res) => {
    const { email, otp } = req.body;
    if (await (0, otp_service_1.verifyOtp)(email, otp)) {
        const user = await user_1.User.findOne({ email });
        user.isVerified = true;
        await user.save();
        const token = jsonwebtoken_1.default.sign({ userId: user._id.toString(), email: user.email, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
        res.status(200).json({
            message: 'OTP verification successful',
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                elo: user.elo,
            },
        });
    }
    else {
        return res.status(401).json({ message: 'Invalid OTP' });
    }
};
exports.otpVerification = otpVerification;
const forgotPasswordOtpVerification = async (req, res) => {
    const { email, vOtp } = req.body;
    if (await (0, otp_service_1.verifyForgotPasswordOtp)(email, vOtp)) {
        const user = await user_1.User.findOne({ email });
        user.isVerified = true;
        user.save;
        const token = jsonwebtoken_1.default.sign({ userId: user._id.toString(), email: user.email, username: user.username }, JWT_SECRET, { expiresIn: '10m' });
        res.status(200).json({
            message: 'Otp Verified successful',
            forgotPasswordAccessToken: token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                elo: user.elo,
            },
        });
    }
    else {
        return res.status(401).json({ message: 'Invalid OTP' });
    }
};
exports.forgotPasswordOtpVerification = forgotPasswordOtpVerification;
const changePassword = async (req, res) => {
    var _a;
    try {
        const { newPassword } = req.body;
        const email = (_a = req.user) === null || _a === void 0 ? void 0 : _a.email;
        if (!newPassword) {
            return res.status(400).json({ message: 'New password is required' });
        }
        const user = await user_1.User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        const hashedPassword = await bcryptjs_1.default.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();
        res.status(200).json({
            message: 'Password changed successfully! You can now log in.'
        });
    }
    catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
};
exports.changePassword = changePassword;
