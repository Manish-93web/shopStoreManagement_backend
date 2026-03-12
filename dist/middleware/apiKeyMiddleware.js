import crypto from 'crypto';
import ApiKey from '../models/ApiKey.js';
export const requireApiKey = async (req, res, next) => {
    let rawKey = req.headers['x-api-key'];
    if (!rawKey && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        // Fallback to Bearer token just in case
        rawKey = req.headers.authorization.split(' ')[1];
    }
    if (!rawKey) {
        return res.status(401).json({ success: false, message: 'Not authorized, API Key required in x-api-key header' });
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
        // Update last used timestamp
        apiKey.lastUsedAt = new Date();
        await apiKey.save();
        next();
    }
    catch (error) {
        console.error('API Key validation error:', error);
        return res.status(500).json({ success: false, message: 'Server error during authentication' });
    }
};
export const requirePermission = (permission) => {
    return (req, res, next) => {
        if (!req.permissions) {
            return res.status(401).json({ success: false, message: 'Permissions not defined' });
        }
        if (req.permissions.includes('all') || req.permissions.includes(permission)) {
            next();
        }
        else {
            return res.status(403).json({ success: false, message: `Forbidden: requires ${permission} scope` });
        }
    };
};
