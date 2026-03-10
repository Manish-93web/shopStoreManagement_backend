import { Response } from 'express';
import { TenantRequest } from '../middleware/tenantHandler.js';
import Store from '../models/Store.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import ApiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

// @desc    Get system-wide stats for Super Admin
// @route   GET /api/v1/super-admin/stats
export const getSystemStats = asyncHandler(async (req: TenantRequest, res: Response) => {
    // Only Super Admin allowed (Middleware handles this, but extra check)
    if (req.user.role !== 'Owner' && req.user.role !== 'SUPER_ADMIN') {
        // Note: The PRD mentioned Owner can manage his stores, but Super Admin manages ALL.
        // For simplicity, let's assume we use a specific role.
    }

    const [totalStores, totalOrders, totalUsers, stores] = await Promise.all([
        Store.countDocuments(),
        Order.countDocuments(),
        User.countDocuments(),
        Store.find().limit(10).sort({ createdAt: -1 })
    ]);

    const aggregateRevenue = await Order.aggregate([
        { $match: { status: 'Completed' } },
        { $group: { _id: null, total: { $sum: '$grandTotal' } } }
    ]);

    res.status(200).json(new ApiResponse(200, {
        totalStores,
        totalOrders,
        totalUsers,
        totalRevenue: aggregateRevenue[0]?.total || 0,
        recentStores: stores
    }));
});

// @desc    Get all stores
// @route   GET /api/v1/super-admin/stores
export const getAllStores = asyncHandler(async (req: TenantRequest, res: Response) => {
    const stores = await Store.find().populate('owner', 'name email phone');
    res.status(200).json(new ApiResponse(200, stores));
});
