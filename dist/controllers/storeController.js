import Store from '../models/Store.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/apiResponse.js';
import Settings from '../models/Settings.js';
// @desc    Get all stores (Super Admin only)
// @route   GET /api/stores
export const getStores = asyncHandler(async (req, res) => {
    const stores = await Store.find().populate('owner', 'name email');
    res.status(200).json(new ApiResponse(200, stores));
});
// @desc    Get stores owned by current user
// @route   GET /api/stores/my-stores
export const getMyStores = asyncHandler(async (req, res) => {
    const stores = await Store.find({ owner: req.user.id });
    res.status(200).json(new ApiResponse(200, stores));
});
// @desc    Create a new store (Owner)
// @route   POST /api/stores
export const createStore = asyncHandler(async (req, res) => {
    const { name, shopType, address, phone, email, currency, timezone } = req.body;
    const store = await Store.create({
        name,
        shopType,
        address,
        phone,
        email,
        currency,
        timezone,
        owner: req.user.id
    });
    // Initialize settings for the new store
    await Settings.create({
        storeId: store._id,
        currency: currency || { code: 'INR', symbol: '₹' },
        timezone: timezone || 'Asia/Kolkata'
    });
    res.status(201).json(new ApiResponse(201, store, "Store created successfully"));
});
// @desc    Update store details
// @route   PUT /api/stores/:id
export const updateStore = asyncHandler(async (req, res) => {
    let store = await Store.findById(req.params.id);
    if (!store) {
        return res.status(404).json(new ApiResponse(404, null, "Store not found"));
    }
    // Ensure only owner or super admin can update
    if (store.owner.toString() !== req.user.id && req.user.role !== 'SUPER_ADMIN') {
        return res.status(403).json(new ApiResponse(403, null, "Not authorized to update this store"));
    }
    store = await Store.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true
    });
    res.status(200).json(new ApiResponse(200, store, "Store updated successfully"));
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
