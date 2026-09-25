import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import ApiKey from '../models/ApiKey.js';
import ApiRequestLog from '../models/ApiRequestLog.js';

export interface PublicApiRequest extends Request {
    tenantId?: string;
    permissions?: string[];
}

export const requireApiKey = async (req: PublicApiRequest, res: Response, next: NextFunction) => {
    let rawKey = req.headers['x-api-key'] as string;

    if (!rawKey && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        // Fallback to Bearer token just in case
        rawKey = req.headers.authorization.split(' ')[1];
    }

    if (!rawKey) {
        return res
            .status(401)
            .json({ success: false, message: 'Not authorized, API Key required in x-api-key header' });
    }

    try {
        // Hash the incoming key
        const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

        // Find the active key matching the hash
        const apiKey = await ApiKey.findOne({ keyHash, isActive: true }).select('+keyHash');

        if (!apiKey) {
            return res.status(401).json({ success: false, message: 'Not authorized, invalid or inactive API Key' });
        }

        // Attach tenant and permissions to request
        req.tenantId = apiKey.tenantId;
        req.permissions = apiKey.permissions;

        // Update last used timestamp + running total, and log this request for
        // the usage-analytics view once the response actually finishes (the
        // real status code isn't known until then). Both are fire-and-forget —
        // a logging failure must never affect the actual API call.
        //
        // The counter update goes through $inc (an atomic DB-side increment),
        // not a read-modify-write of the in-memory document — two requests on
        // the same key arriving close together would otherwise both read the
        // same starting count and each save() only +1 from it, silently
        // losing an increment under any real concurrent traffic.
        ApiKey.updateOne({ _id: apiKey._id }, { $set: { lastUsedAt: new Date() }, $inc: { usageCount: 1 } }).catch(
            () => {}
        );

        res.on('finish', () => {
            ApiRequestLog.create({
                apiKeyId: apiKey._id,
                tenantId: apiKey.tenantId,
                method: req.method,
                path: req.path,
                statusCode: res.statusCode,
            }).catch(() => {});
        });

        next();
    } catch (error) {
        console.error('API Key validation error:', error);
        return res.status(500).json({ success: false, message: 'Server error during authentication' });
    }
};

export const requirePermission = (permission: string) => {
    return (req: PublicApiRequest, res: Response, next: NextFunction) => {
        if (!req.permissions) {
            return res.status(401).json({ success: false, message: 'Permissions not defined' });
        }

        if (req.permissions.includes('all') || req.permissions.includes(permission)) {
            next();
        } else {
            return res.status(403).json({ success: false, message: `Forbidden: requires ${permission} scope` });
        }
    };
};
