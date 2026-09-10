import { Request, Response, NextFunction } from 'express';
import ApiResponse from '../utils/apiResponse.js';
import logger from '../utils/logger.js';

// Centralized error handler — registered last in app.ts, after Sentry's handler
// (which captures the error and calls next(err)). This is what actually shapes
// the response every API consumer sees, instead of Express's default HTML/JSON.
export const errorHandler = (err: any, req: Request, res: Response, _next: NextFunction) => {
    let statusCode = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
    let message = err.message || 'Internal Server Error';

    // Mongoose validation errors
    if (err.name === 'ValidationError') {
        statusCode = 400;
        message = Object.values(err.errors as Record<string, any>)
            .map((e: any) => e.message)
            .join(', ');
    }

    // Mongoose bad ObjectId
    if (err.name === 'CastError') {
        statusCode = 400;
        message = `Invalid ${err.path}: ${err.value}`;
    }

    // Mongoose duplicate key
    if (err.code === 11000) {
        statusCode = 409;
        const field = Object.keys(err.keyValue || {})[0];
        message = field ? `${field} already exists` : 'Duplicate value';
    }

    // Invalid/expired JWT
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Invalid or expired session';
    }

    logger.error(`${req.method} ${req.originalUrl} — ${message}`, {
        statusCode,
        stack: err.stack,
        storeId: (req as any).tenantId,
        userId: (req as any).user?._id,
    });

    res.status(statusCode).json(
        new ApiResponse(
            statusCode,
            null,
            process.env.NODE_ENV === 'production' && statusCode === 500 ? 'Internal Server Error' : message
        )
    );
};
