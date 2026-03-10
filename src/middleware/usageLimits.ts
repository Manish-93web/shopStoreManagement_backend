import { Response, NextFunction } from 'express';
import { TenantRequest } from './tenantHandler.js';
import Store from '../models/Store.js';
import Product from '../models/Product.js';
import ApiResponse from '../utils/apiResponse.js';

export const checkUsageLimits = (resource: 'STORE' | 'PRODUCT' | 'USER') => {
    return async (req: TenantRequest, res: Response, next: NextFunction) => {
        const tenantId = req.tenantId;
        if (!tenantId) return next();

        const store = await Store.findById(tenantId);
        if (!store) return next();

        const plan = store.subscriptionPlan; // 'Free' | 'Basic' | 'Premium' | 'Enterprise'

        let limit = 0;
        let currentCount = 0;

        if (resource === 'PRODUCT') {
            limit = plan === 'Free' ? 50 : plan === 'Basic' ? 500 : plan === 'Premium' ? 5000 : Infinity;
            currentCount = await Product.countDocuments({ storeId: tenantId });
        } else if (resource === 'STORE') {
            limit = plan === 'Free' ? 1 : plan === 'Basic' ? 5 : plan === 'Premium' ? 20 : Infinity;
        }

        if (currentCount >= limit) {
            return res.status(403).json(new ApiResponse(403, null, `Resource limit reached for your ${plan} plan. Please upgrade to add more ${resource.toLowerCase()}s.`));
        }

        next();
    };
};

export const checkTrialExpiry = async (req: TenantRequest, res: Response, next: NextFunction) => {
    const tenantId = req.tenantId;
    if (!tenantId) return next();

    const store = await Store.findById(tenantId);
    if (!store) return next();

    // In our simplified Store model, we use subscriptionStatus and isActive
    if (!store.isActive || store.subscriptionStatus === 'Cancelled') {
        return res.status(403).json(new ApiResponse(403, null, "Your subscription is inactive or cancelled. Please upgrade to continue."));
    }

    next();
};
