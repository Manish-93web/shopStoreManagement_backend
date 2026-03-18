import { Response, NextFunction } from 'express';
import { TenantRequest } from './tenantHandler.js';
import Store from '../models/Store.js';
import ApiResponse from '../utils/apiResponse.js';

/**
 * Middleware to check if a store has access to a specific feature based on their plan or direct enablement.
 * @param featureName The name of the feature to check (e.g., 'POS Access', 'Basic Analytics')
 */
export const checkFeatureAccess = (featureName: string) => {
    return async (req: TenantRequest, res: Response, next: NextFunction) => {
        // Super Admins bypass all feature checks
        if ((req as any).user?.role === 'SUPER_ADMIN') {
            return next();
        }

        const tenantId = req.tenantId;
        if (!tenantId) {
            return res.status(400).json(new ApiResponse(400, null, "Store ID is required to verify feature access"));
        }

        const store = await Store.findById(tenantId).populate('subscriptionPlan');
        if (!store) {
            return res.status(404).json(new ApiResponse(404, null, "Store not found"));
        }

        // Check if feature is explicitly enabled for this store OR included in their plan
        const hasAccess = 
            (store.featuresEnabled && store.featuresEnabled.includes(featureName)) ||
            (store.subscriptionPlan && (store.subscriptionPlan as any).features && (store.subscriptionPlan as any).features.includes(featureName));

        if (!hasAccess) {
            return res.status(403).json(new ApiResponse(403, null, `Your current plan does not include access to the "${featureName}" feature. Please upgrade to continue.`));
        }

        next();
    };
};
