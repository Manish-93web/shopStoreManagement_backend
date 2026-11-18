import Store from '../models/Store.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import ApiResponse from '../utils/apiResponse.js';
// Once a Super Admin has approved a tenant (and it is active), plan resource limits no
// longer apply to it — the Super Admin manages what that tenant gets from the dashboard.
export const isTenantApproved = (store) => !!store && store.status === 'Approved' && store.isActive !== false;
// An approved tenant that is still on the trial can use everything, but only add a few products.
export const TRIAL_PRODUCT_LIMIT = 10;
export const isTrialTenant = (store) => isTenantApproved(store) && store.subscriptionStatus === 'Trialing';
export const INACTIVE_ACCOUNT_MESSAGE = 'Your account is not active. Please contact Administration.';
export const trialProductLimitMessage = `Trial accounts can add up to ${TRIAL_PRODUCT_LIMIT} products. Please contact Administration to activate your plan.`;
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
        if (isTrialTenant(store)) {
            if (resource !== 'PRODUCT')
                return next();
            const count = await Product.countDocuments({ storeId: tenantId });
            if (count >= TRIAL_PRODUCT_LIMIT) {
                return res.status(403).json(new ApiResponse(403, null, trialProductLimitMessage));
            }
            return next();
        }
        if (isTenantApproved(store))
            return next();
        // If no plan is assigned, fallback to "Free" logic or a default plan
        let limits = { orders: 50, products: 20, maxStores: 1, maxUsers: 2 };
        if (store.subscriptionPlan) {
            const plan = store.subscriptionPlan; // Hydrated Plan document
            limits = {
                orders: plan.maxOrders || 100, // Assuming maxOrders might be added, or use features
                products: plan.maxProducts,
                maxStores: plan.maxStores,
                maxUsers: plan.maxUsers,
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
        // A limit of 0 means unlimited on a plan (as in the Plans form: 0 for Unlimited).
        if (limit !== 0 && currentCount >= limit) {
            return res
                .status(403)
                .json(new ApiResponse(403, null, `Resource limit reached for your plan. Please upgrade to add more ${resource.toLowerCase()}s.`));
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
    // Pending (not yet approved) and Suspended tenants are locked out until Administration acts.
    if (store.status === 'Pending' || store.status === 'Suspended') {
        return res.status(403).json(new ApiResponse(403, null, INACTIVE_ACCOUNT_MESSAGE));
    }
    if (!store.isActive || store.subscriptionStatus === 'Cancelled' || store.subscriptionStatus === 'Past Due') {
        return res
            .status(403)
            .json(new ApiResponse(403, null, 'Your subscription is inactive or past due. Please update payment.'));
    }
    if (store.subscriptionStatus === 'Trialing' && store.trialEndsAt && new Date() > store.trialEndsAt) {
        return res
            .status(403)
            .json(new ApiResponse(403, null, 'Your trial has expired. Please upgrade to a paid plan to continue.'));
    }
    next();
};
