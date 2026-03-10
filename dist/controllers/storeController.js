import Store from '../models/Store.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/apiResponse.js';
// @desc    Get all stores (Super Admin only)
// @route   GET /api/stores
export const getStores = asyncHandler(async (req, res) => {
    const stores = await Store.find().populate('owner', 'name email');
    res.status(200).json(new ApiResponse(200, stores));
});
// @desc    Toggle store active status
// @route   PATCH /api/stores/:id/toggle
export const toggleStoreStatus = asyncHandler(async (req, res) => {
    const store = await Store.findById(req.params.id);
    if (!store) {
        return res.status(404).json(new ApiResponse(404, null, "Store not found"));
    }
    store.isActive = !store.isActive;
    await store.save();
    res.status(200).json(new ApiResponse(200, store, `Store ${store.isActive ? 'activated' : 'suspended'} successfully`));
});
