import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import ApiResponse from '../utils/apiResponse.js';

export interface AuthRequest extends Request {
    user?: any;
}

export const protect = async (req: AuthRequest, res: Response, next: NextFunction) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return res.status(401).json(new ApiResponse(401, null, "Not authorized to access this route"));
    }

    try {
        const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
        req.user = await User.findById(decoded.id).select('-password');
        next();
    } catch (error) {
        return res.status(401).json(new ApiResponse(401, null, "Not authorized to access this route"));
    }
};

export const authorize = (...roles: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json(new ApiResponse(403, null, `User role ${req.user.role} is not authorized`));
        }
        next();
    };
};
