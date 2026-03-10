import { Request, Response, NextFunction } from 'express';
import ApiResponse from '../utils/apiResponse.js';

export interface TenantRequest extends Request {
    tenantId?: string;
    user?: any;
}

export const tenantHandler = (req: TenantRequest, res: Response, next: NextFunction) => {
    // Extract tenantId from token (injected by protect middleware)
    const tenantId = req.user?.storeId;

    if (!tenantId && req.user?.role !== 'SUPER_ADMIN') {
        return res.status(400).json(new ApiResponse(400, null, "Store ID is required for this operation"));
    }

    req.tenantId = tenantId?.toString();
    next();
};
