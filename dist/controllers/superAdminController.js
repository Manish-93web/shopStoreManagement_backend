import Store from '../models/Store.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import ApiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { notificationService } from '../services/notificationService.js';
// @desc    Get system-wide stats for Super Admin
// @route   GET /api/v1/super-admin/stats
export const getSystemStats = asyncHandler(async (req, res) => {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const [totalStores, totalOrders, totalUsers, stores, aggregateRevenue, monthlyRevenue] = await Promise.all([
        Store.countDocuments(),
        Order.countDocuments(),
        User.countDocuments(),
        Store.find().populate('subscriptionPlan').limit(10).sort({ createdAt: -1 }),
        Order.aggregate([
            { $match: { status: 'Completed' } },
            { $group: { _id: null, total: { $sum: '$grandTotal' } } }
        ]),
        Order.aggregate([
            { $match: { status: 'Completed', createdAt: { $gte: startOfMonth } } },
            { $group: { _id: null, total: { $sum: '$grandTotal' } } }
        ])
    ]);
    res.status(200).json(new ApiResponse(200, {
        totalStores,
        totalOrders,
        totalUsers,
        totalRevenue: aggregateRevenue[0]?.total || 0,
        monthlyRevenue: monthlyRevenue[0]?.total || 0,
        recentStores: stores
    }));
});
// @desc    Get all stores (Tenants)
// @route   GET /api/v1/super-admin/stores
export const getAllStores = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, search = '' } = req.query;
    const query = search ? { name: { $regex: search, $options: 'i' } } : {};
    const stores = await Store.find(query)
        .populate('owner', 'name email phone')
        .populate('subscriptionPlan')
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
export const toggleStoreStatus = asyncHandler(async (req, res) => {
    const store = await Store.findById(req.params.id);
    if (!store)
        return res.status(404).json(new ApiResponse(404, null, "Store not found"));
    store.isActive = !store.isActive;
    store.status = store.isActive ? 'Approved' : 'Suspended';
    await store.save();
    res.status(200).json(new ApiResponse(200, store, `Store ${store.isActive ? 'Reactivated' : 'Suspended'}`));
});
// @desc    Approve/Reject store registration
// @route   PUT /api/v1/super-admin/stores/:id/approve
export const approveStore = asyncHandler(async (req, res) => {
    const { approve } = req.body;
    const store = await Store.findById(req.params.id);
    if (!store)
        return res.status(404).json(new ApiResponse(404, null, "Store not found"));
    if (approve) {
        store.status = 'Approved';
        store.isActive = true;
    }
    else {
        // Rejection could delete or just mark as suspended/rejected
        store.status = 'Suspended';
        store.isActive = false;
    }
    await store.save();
    res.status(200).json(new ApiResponse(200, store, `Store ${approve ? 'Approved' : 'Rejected'}`));
});
// @desc    Get Platform Audit Logs
// @route   GET /api/v1/super-admin/audit-logs
export const getSystemAuditLogs = asyncHandler(async (req, res) => {
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
export const broadcastNotification = asyncHandler(async (req, res) => {
    const { title, message, type = 'info' } = req.body;
    if (!title || !message) {
        return res.status(400).json(new ApiResponse(400, null, "Title and message are required"));
    }
    // Find all store owners
    const owners = await User.find({ role: 'STORE_OWNER', isActive: true });
    // Use notificationService to send to each
    const notificationPromises = owners.map(owner => notificationService.send({
        recipientId: owner._id,
        storeId: owner.storeId, // Most owners have a primary storeId
        title: `[SYSTEM] ${title}`,
        message,
        type
    }));
    await Promise.all(notificationPromises);
    res.status(200).json(new ApiResponse(200, null, `Broadcast sent to ${owners.length} owners`));
});
