import Store from '../models/Store.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import ApiResponse from '../utils/apiResponse.js';
export const checkUsageLimits = (resource) => {
    return async (req, res, next) => {
        const tenantId = req.tenantId;
        if (!tenantId)
            return next();
        // Super Admins bypass all limits
        if (req.user?.role === 'SUPER_ADMIN') {
            return next();
        }
        const store = await Store.findById(tenantId).populate('subscriptionPlan');
        if (!store)
            return next();
        // If no plan is assigned, fallback to "Free" logic or a default plan
        let limits = { orders: 50, products: 20, maxStores: 1, maxUsers: 2 };
        if (store.subscriptionPlan) {
            const plan = store.subscriptionPlan; // Hydrated Plan document
            limits = {
                orders: plan.maxOrders || 100, // Assuming maxOrders might be added, or use features
                products: plan.maxProducts,
                maxStores: plan.maxStores,
                maxUsers: plan.maxUsers
            };
        }
        let limit = Infinity;
        let currentCount = 0;
        if (resource === 'PRODUCT') {
            limit = limits.products;
            currentCount = await Product.countDocuments({ storeId: tenantId });
        }
        else if (resource === 'STORE') {
            limit = limits.maxStores;
            currentCount = await Store.countDocuments({ owner: store.owner });
        }
        else if (resource === 'USER') {
            limit = limits.maxUsers;
            currentCount = await User.countDocuments({ storeId: tenantId });
        }
        else if (resource === 'ORDER') {
            limit = limits.orders;
            // Count orders this month
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);
            currentCount = await Order.countDocuments({ storeId: tenantId, createdAt: { $gte: startOfMonth } });
        }
        if (currentCount >= limit) {
            return res.status(403).json(new ApiResponse(403, null, `Resource limit reached for your plan. Please upgrade to add more ${resource.toLowerCase()}s.`));
        }
        next();
    };
};
export const checkTrialExpiry = async (req, res, next) => {
    const tenantId = req.tenantId;
    if (!tenantId)
        return next();
    // Super Admins bypass all limits
    if (req.user?.role === 'SUPER_ADMIN') {
        return next();
    }
    const store = await Store.findById(tenantId);
    if (!store)
        return next();
    if (!store.isActive || store.subscriptionStatus === 'Cancelled' || store.subscriptionStatus === 'Past Due') {
        return res.status(403).json(new ApiResponse(403, null, "Your subscription is inactive or past due. Please update payment."));
    }
    if (store.subscriptionStatus === 'Trialing' && store.trialEndsAt && new Date() > store.trialEndsAt) {
        return res.status(403).json(new ApiResponse(403, null, "Your trial has expired. Please upgrade to a paid plan to continue."));
    }
    next();
};
