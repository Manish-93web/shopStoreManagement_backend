import FeatureFlag from '../models/FeatureFlag.js';
import Store from '../models/Store.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/apiResponse.js';
// @desc    Evaluate all feature flags for the current tenant
// @route   GET /api/feature-flags/evaluate
// @access  Private (Tenant)
export const evaluateFeatureFlags = asyncHandler(async (req, res) => {
    // 1. Handle Super Admin (Access to all active flags)
    if (req.user?.role === 'SUPER_ADMIN') {
        const allFlags = await FeatureFlag.find({});
        const evaluatedFlags = {};
        allFlags.forEach(flag => {
            evaluatedFlags[flag.key] = flag.isActive;
        });
        return res.status(200).json(new ApiResponse(200, evaluatedFlags));
    }
    // 2. Tenant Context Required
    if (!req.tenantId) {
        return res.status(400).json(new ApiResponse(400, null, "Store ID context required"));
    }
    const store = await Store.findById(req.tenantId);
    if (!store) {
        return res.status(404).json(new ApiResponse(404, null, "Store not found"));
    }
    const allFlags = await FeatureFlag.find({});
    const evaluatedFlags = {};
    allFlags.forEach(flag => {
        // 1. Check if disabled globally
        if (!flag.isActive) {
            evaluatedFlags[flag.key] = false;
        }
        // 2. Check blacklist (overrides everything)
        else if (flag.disabledTenants.some(id => id.toString() === store._id.toString())) {
            evaluatedFlags[flag.key] = false;
        }
        // 3. Check whitelist (overrides plan rules)
        else if (flag.enabledTenants.some(id => id.toString() === store._id.toString())) {
            evaluatedFlags[flag.key] = true;
        }
        // 4. Check plan targeting
        else if (flag.targetPlans && flag.targetPlans.length > 0) {
            if (store.subscriptionPlan && flag.targetPlans.some(p => p.toString() === store.subscriptionPlan.toString())) {
                evaluatedFlags[flag.key] = true;
            }
            else {
                evaluatedFlags[flag.key] = false;
            }
        }
        // 5. Default to True if active globally and no targeting rules apply
        else {
            evaluatedFlags[flag.key] = true;
        }
    });
    res.status(200).json(new ApiResponse(200, evaluatedFlags));
});
// ============================================
// SUPER ADMIN ROUTES
// ============================================
// @desc    Get all feature flags
// @route   GET /api/super-admin/feature-flags
// @access  SuperAdmin
export const getAllFeatureFlags = asyncHandler(async (req, res) => {
    const flags = await FeatureFlag.find({})
        .populate('targetPlans', 'name')
        .populate('enabledTenants', 'name')
        .populate('disabledTenants', 'name');
    res.status(200).json(new ApiResponse(200, flags));
});
// @desc    Create a feature flag
// @route   POST /api/super-admin/feature-flags
// @access  SuperAdmin
export const createFeatureFlag = asyncHandler(async (req, res) => {
    const flag = await FeatureFlag.create(req.body);
    res.status(201).json(new ApiResponse(201, flag, "Feature flag created"));
});
// @desc    Update a feature flag
// @route   PUT /api/super-admin/feature-flags/:id
// @access  SuperAdmin
export const updateFeatureFlag = asyncHandler(async (req, res) => {
    const flag = await FeatureFlag.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after' });
    if (!flag)
        return res.status(404).json(new ApiResponse(404, null, "Flag not found"));
    res.status(200).json(new ApiResponse(200, flag, "Feature flag updated"));
});
// @desc    Delete a feature flag
// @route   DELETE /api/super-admin/feature-flags/:id
// @access  SuperAdmin
export const deleteFeatureFlag = asyncHandler(async (req, res) => {
    await FeatureFlag.findByIdAndDelete(req.params.id);
    res.status(200).json(new ApiResponse(200, null, "Feature flag deleted"));
});
