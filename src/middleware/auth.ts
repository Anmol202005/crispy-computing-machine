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

