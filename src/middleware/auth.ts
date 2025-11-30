import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest, JwtPayload } from '../types';

export const authenticateToken = (
    req: AuthRequest,
    res: Response,
    next:NextFunction
) => {
    const header = req.header('authorization');
    const token = header && header.split(" ")[1];

    if(!token){
        return res.status(401).json({message: 'Access Token Required'});
    }

    try{
        const decode = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
        req.user=decode;
        next();
    }
    catch(error){
        return res.status(403).json({message:"Invalid or Expired Token"});
    }
};

// Optional authentication - populates req.user if token provided, but doesn't reject if missing
export const optionalAuth = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => {
    const header = req.header('authorization');
    const token = header && header.split(" ")[1];

    // No token - continue without authentication (guest user)
    if (!token) {
        return next();
    }

    // Token provided - try to verify it
    try {
        const decode = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
        req.user = decode;
        next();
    } catch (error) {
        // Invalid token - treat as guest
        console.log('Invalid token in optionalAuth, treating as guest');
        next();
    }
};

