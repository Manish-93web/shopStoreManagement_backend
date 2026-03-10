import Store from '../models/Store.js';
import ApiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
export const subscriptionController = {
    // @desc    Get current subscription plan
    getSubscription: asyncHandler(async (req, res) => {
        const store = await Store.findById(req.tenantId).select('subscriptionPlan subscriptionStatus plan');
        if (!store)
            return res.status(404).json(new ApiResponse(404, null, "Store not found"));
        res.status(200).json(new ApiResponse(200, {
            plan: store.subscriptionPlan,
            status: store.subscriptionStatus,
            tier: store.plan
        }));
    }),
    // @desc    Update subscription plan (mock)
    upgradePlan: asyncHandler(async (req, res) => {
        const { planId } = req.body;
        const store = await Store.findByIdAndUpdate(req.tenantId, {
            $set: {
                subscriptionPlan: planId, // e.g. 'Premium'
                subscriptionStatus: 'Active',
                lastBillingDate: new Date()
            }
        }, { new: true });
        res.status(200).json(new ApiResponse(200, {
            plan: store?.subscriptionPlan,
            status: store?.subscriptionStatus
        }, "Plan upgraded successfully"));
    })
};
