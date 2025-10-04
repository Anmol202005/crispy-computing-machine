import {Router} from "express"

import {
    registerUser,
    login,
    resendOtp,
    forgotPassword,
    otpVerification,
    forgotPasswordOtpVerification,
    changePassword
} from "../controllers/auth"

import { authenticateToken } from "../middleware/auth"

const router = Router();

router.post('/register', registerUser);
router.post('/verify-email', otpVerification);
router.post('/resend-otp', resendOtp);
router.post('/login', login);

router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-otp', forgotPasswordOtpVerification);
router.post('/change-password', authenticateToken, changePassword);

export default router;