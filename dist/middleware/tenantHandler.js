import ApiResponse from '../utils/apiResponse.js';
export const tenantHandler = (req, res, next) => {
    // Extract tenantId from token (injected by protect middleware)
    const tenantId = req.user?.storeId;
    if (!tenantId && req.user?.role !== 'SUPER_ADMIN') {
        return res.status(400).json(new ApiResponse(400, null, "Store ID is required for this operation"));
    }
    req.tenantId = tenantId?.toString();
    next();
};
