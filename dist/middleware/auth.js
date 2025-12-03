"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionalAuth = exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const authenticateToken = (req, res, next) => {
    const header = req.header('authorization');
    const token = header && header.split(" ")[1];
    if (!token) {
        return res.status(401).json({ message: 'Access Token Required' });
    }
    try {
        const decode = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        req.user = decode;
        next();
    }
    catch (error) {
        return res.status(403).json({ message: "Invalid or Expired Token" });
    }
};
exports.authenticateToken = authenticateToken;
// Optional authentication - populates req.user if token provided, but doesn't reject if missing
const optionalAuth = (req, res, next) => {
    const header = req.header('authorization');
    const token = header && header.split(" ")[1];
    // No token - continue without authentication (guest user)
    if (!token) {
        return next();
    }
    // Token provided - try to verify it
    try {
        const decode = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        req.user = decode;
        next();
    }
    catch (error) {
        // Invalid token - treat as guest
        console.log('Invalid token in optionalAuth, treating as guest');
        next();
    }
};
exports.optionalAuth = optionalAuth;
