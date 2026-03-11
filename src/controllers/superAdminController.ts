import { Response } from 'express';
import { TenantRequest } from '../middleware/tenantHandler.js';
import Store from '../models/Store.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import ApiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

// @desc    Get system-wide stats for Super Admin
// @route   GET /api/v1/super-admin/stats
export const getSystemStats = asyncHandler(async (req: TenantRequest, res: Response) => {
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

// @desc    Get all stores (Tenants)
// @route   GET /api/v1/super-admin/stores
export const getAllStores = asyncHandler(async (req: TenantRequest, res: Response) => {
    const { page = 1, limit = 10, search = '' } = req.query;
    const query = search ? { name: { $regex: search, $options: 'i' } } : {};

    const stores = await Store.find(query)
        .populate('owner', 'name email phone')
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit))
        .sort({ createdAt: -1 });

    const total = await Store.countDocuments(query);

    res.status(200).json(new ApiResponse(200, {
        stores,
        totalPages: Math.ceil(total / Number(limit)),
        currentPage: Number(page),
        totalTenants: total
    }));
});

// @desc    Toggle store active status (Suspend/Reactivate)
// @route   PUT /api/v1/super-admin/stores/:id/status
export const toggleStoreStatus = asyncHandler(async (req: TenantRequest, res: Response) => {
    const store = await Store.findById(req.params.id);
    if (!store) return res.status(404).json(new ApiResponse(404, null, "Store not found"));

    store.isActive = !store.isActive;
    await store.save();

    res.status(200).json(new ApiResponse(200, store, `Store ${store.isActive ? 'Reactivated' : 'Suspended'}`));
});

// @desc    Get Platform Audit Logs
// @route   GET /api/v1/super-admin/audit-logs
export const getSystemAuditLogs = asyncHandler(async (req: TenantRequest, res: Response) => {
    const { page = 1, limit = 20 } = req.query;
    const logs = await AuditLog.find()
        .populate('userId', 'name email')
        .populate('storeId', 'name')
        .sort({ createdAt: -1 })
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit));

    const total = await AuditLog.countDocuments();

    res.status(200).json(new ApiResponse(200, {
        logs,
        totalPages: Math.ceil(total / Number(limit)),
        currentPage: Number(page)
    }));
});

// @desc    Broadcast notification to all active store owners
// @route   POST /api/v1/super-admin/broadcast
export const broadcastNotification = asyncHandler(async (req: TenantRequest, res: Response) => {
    const { title, message, type = 'info' } = req.body;

    if (!title || !message) {
        return res.status(400).json(new ApiResponse(400, null, "Title and message are required"));
    }

    // Find all store owners
    const owners = await User.find({ role: 'STORE_OWNER', isActive: true });

    // Use notificationService to send to each
    const notificationPromises = owners.map(owner =>
        notificationService.send({
            recipientId: owner._id as string,
            storeId: owner.storeId as any, // Most owners have a primary storeId
            title: `[SYSTEM] ${title}`,
            message,
            type,
            level: 'HIGH'
        })
    );

    await Promise.all(notificationPromises);

    res.status(200).json(new ApiResponse(200, null, `Broadcast sent to ${owners.length} owners`));
});
