import { Response, NextFunction } from 'express';
import { TenantRequest } from './tenantHandler.js';
import Store from '../models/Store.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import ApiResponse from '../utils/apiResponse.js';

const PLAN_LIMITS: Record<string, any> = {
    'Free': { orders: 100, products: 50 },
    'Basic': { orders: 1000, products: 500 },
    'Premium': { orders: 5000, products: 2000 },
    'Enterprise': { orders: Infinity, products: Infinity }
};

export const checkUsageLimits = (resource: 'STORE' | 'PRODUCT' | 'USER' | 'ORDER') => {
    return async (req: TenantRequest, res: Response, next: NextFunction) => {
        const tenantId = req.tenantId;
        if (!tenantId) return next();

        const store = await Store.findById(tenantId);
        if (!store) return next();

        const plan = store.subscriptionPlan || 'Free';
        const limits = PLAN_LIMITS[plan] || PLAN_LIMITS['Free'];

        let limit = Infinity;
        let currentCount = 0;

        if (resource === 'PRODUCT') {
            limit = limits.products;
            currentCount = await Product.countDocuments({ storeId: tenantId });
        } else if (resource === 'STORE') {
            limit = plan === 'Free' ? 1 : plan === 'Basic' ? 5 : plan === 'Premium' ? 20 : Infinity;
        } else if (resource === 'ORDER') {
            limit = limits.orders;
            // Count orders this month
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);
            currentCount = await Order.countDocuments({ storeId: tenantId, createdAt: { $gte: startOfMonth } });
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

    if (!store.isActive || store.subscriptionStatus === 'Cancelled' || store.subscriptionStatus === 'Past Due') {
        return res.status(403).json(new ApiResponse(403, null, "Your subscription is inactive or past due. Please update payment."));
    }

    if (store.subscriptionStatus === 'Trialing' && store.trialEndsAt && new Date() > store.trialEndsAt) {
        return res.status(403).json(new ApiResponse(403, null, "Your 14-day trial has expired. Please upgrade to a paid plan to continue."));
    }

    next();
};

