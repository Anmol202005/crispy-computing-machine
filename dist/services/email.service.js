"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendVerificationEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const EMAIL_HOST = process.env.EMAIL_HOST;
const EMAIL_PORT = process.env.EMAIL_PORT;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD;
const EMAIL_FROM = process.env.EMAIL_FROM;
const transporter = nodemailer_1.default.createTransport({
    host: EMAIL_HOST,
    port: parseInt(EMAIL_PORT),
    secure: false,
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASSWORD,
    },
});
const sendVerificationEmail = async (email, username, OTP) => {
    const mailOptions = {
        from: `Chessy <${EMAIL_FROM}>`,
        to: email,
        subject: 'Verify Your Email - Chessy',
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h1 style="color: #333;">Hi ${username}! 👋</h1>
  <p style="font-size: 16px; color: #555;">
    Use the One-Time Password (OTP) below to verify your email address.
  </p>
  <div style="text-align: center; margin: 30px 0;">
    <div style="display: inline-block; background-color: #4CAF50; color: white; 
                padding: 15px 40px; border-radius: 8px; font-size: 24px; 
                font-weight: bold; letter-spacing: 3px;">
      ${OTP}
    </div>
  </div>
  <p style="font-size: 14px; color: #777;"> 
    <br>If you didn’t request this, you can safely ignore this email.
  </p>
  <p style="font-size: 12px; color: #999; margin-top: 30px;">
    This OTP is valid for 10 minutes.
  </p>
</div>

    `,
    };
    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`Verification email sent to ${email} (Message ID: ${info.messageId})`);
    }
    catch (error) {
        console.error(' Failed to send verification email:', error.message);
        throw new Error('Failed to send verification email');
    }
};
exports.sendVerificationEmail = sendVerificationEmail;
