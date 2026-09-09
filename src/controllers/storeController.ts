import { Request, Response } from 'express';
import Store from '../models/Store.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/apiResponse.js';
import Settings from '../models/Settings.js';
import User from '../models/User.js';
import Plan from '../models/Plan.js';

// @desc    Get all stores (Super Admin only)
// @route   GET /api/stores
export const getStores = asyncHandler(async (req: Request, res: Response) => {
    const stores = await Store.find().populate('owner', 'name email');
    res.status(200).json(new ApiResponse(200, stores));
});

// @desc    Get stores owned by current user
// @route   GET /api/stores/my-stores
export const getMyStores = asyncHandler(async (req: any, res: Response) => {
    const stores = await Store.find({ owner: req.user.id });
    res.status(200).json(new ApiResponse(200, stores));
});

// @desc    Create a new store (Owner)
// @route   POST /api/stores
export const createStore = asyncHandler(async (req: any, res: Response) => {
    // Check Plan Limits
    const user = await User.findById(req.user.id).populate({
        path: 'stores',
        populate: { path: 'subscriptionPlan' }
    });

    if (user) {
        let maxStores = 1; // Default for trial
        (user.stores as any).forEach((s: any) => {
            if (s.subscriptionPlan && (s.subscriptionPlan.maxStores === 0 || s.subscriptionPlan.maxStores > maxStores)) {
                maxStores = s.subscriptionPlan.maxStores;
            }
        });

        if (maxStores !== 0 && user.stores.length >= maxStores) {
            return res.status(403).json(new ApiResponse(403, null, `Store limit reached. Your current plan allows up to ${maxStores} stores.`));
        }
    }

    const { name, shopType, address, phone, email, currency, timezone } = req.body;

    // Auto-assign the Free plan to all new stores
    const freePlan = await Plan.findOne({ name: 'Free', isActive: true });

    const store = await Store.create({
        name,
        shopType,
        address,
        phone,
        email,
        currency,
        timezone,
        owner: req.user.id,
        subscriptionPlan: freePlan?._id
    });

    // Initialize settings for the new store
    await Settings.create({
        storeId: store._id,
        currency: currency || { code: 'INR', symbol: '₹' },
        timezone: timezone || 'Asia/Kolkata'
    });

    await User.findByIdAndUpdate(req.user.id, { $addToSet: { stores: store._id } });

    res.status(201).json(new ApiResponse(201, store, "Store created successfully"));
});

// @desc    Update store details
// @route   PUT /api/stores/:id
export const updateStore = asyncHandler(async (req: any, res: Response) => {
    let store = await Store.findById(req.params.id);

    if (!store) {
        return res.status(404).json(new ApiResponse(404, null, "Store not found"));
    }

    // Ensure only owner or super admin can update
    if (store.owner.toString() !== req.user.id && req.user.role !== 'SUPER_ADMIN') {
        return res.status(403).json(new ApiResponse(403, null, "Not authorized to update this store"));
    }

    store = await Store.findByIdAndUpdate(req.params.id, req.body, {
        returnDocument: 'after',
        runValidators: true
    });

    res.status(200).json(new ApiResponse(200, store, "Store updated successfully"));
});

// @desc    Toggle store active status
// @route   PATCH /api/stores/:id/toggle
export const toggleStoreStatus = asyncHandler(async (req: Request, res: Response) => {
    const store = await Store.findById(req.params.id);
    if (!store) {
        return res.status(404).json(new ApiResponse(404, null, "Store not found"));
    }

    store.isActive = !store.isActive;
    await store.save();

    res.status(200).json(new ApiResponse(200, store, `Store ${store.isActive ? 'activated' : 'suspended'} successfully`));
});
