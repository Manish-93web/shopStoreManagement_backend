import ApiResponse from '../utils/apiResponse.js';
export const tenantHandler = (req, res, next) => {
    // 1. Check x-store-id header (standard for frontend API calls)
    let tenantId = req.headers['x-store-id'] || req.headers['X-Store-Id'];
    // 2. Fallback to user.storeId (for staff members)
    if (!tenantId) {
        tenantId = req.user?.storeId;
    }
    if (!tenantId && req.user?.role === 'STORE_OWNER' && req.user?.stores?.length > 0) {
        tenantId = req.user.stores[0];
    }
    // Sanitize: Handle literal "undefined" or "null" strings from frontend
    if (tenantId === 'undefined' || tenantId === 'null') {
        tenantId = undefined;
    }
    if (!tenantId && req.user?.role !== 'SUPER_ADMIN') {
        return res.status(400).json(new ApiResponse(400, null, "Store ID is required for this operation"));
    }
    req.tenantId = tenantId?.toString();
    next();
};
