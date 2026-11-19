import dayjs from 'dayjs';
import AuditLog from '../models/AuditLog.js';
import User from '../models/User.js';
import ApiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
// @desc    Audit trail for the current store — the store-scoped counterpart to
//          Super Admin's platform-wide log viewer (which only Super Admin can
//          reach). Store owners/managers had no way to see who changed a price,
//          adjusted stock, or deleted a record in their own store.
// @route   GET /api/v1/audit-logs
export const getStoreAuditLogs = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, action = '', entity = '', startDate = '', endDate = '', search = '' } = req.query;
    const query = { storeId: req.tenantId };
    if (action)
        query.action = action;
    if (entity)
        query.entity = entity;
    if (startDate || endDate) {
        query.createdAt = {};
        if (startDate)
            query.createdAt.$gte = dayjs(startDate)
                .startOf('day')
                .toDate();
        if (endDate)
            query.createdAt.$lte = dayjs(endDate)
                .endOf('day')
                .toDate();
    }
    if (search) {
        const matchingUsers = await User.find({ name: { $regex: search, $options: 'i' } }).select('_id');
        const userIds = matchingUsers.map((u) => u._id);
        if (userIds.length === 0) {
            return res
                .status(200)
                .json(new ApiResponse(200, {
                logs: [],
                totalPages: 0,
                currentPage: Number(page),
                distinctActions: [],
                distinctEntities: [],
            }));
        }
        query.userId = { $in: userIds };
    }
    const [logs, total, distinctActions, distinctEntities] = await Promise.all([
        AuditLog.find(query)
            .populate('userId', 'name email')
            .sort({ createdAt: -1 })
            .limit(Number(limit))
            .skip((Number(page) - 1) * Number(limit)),
        AuditLog.countDocuments(query),
        AuditLog.distinct('action', { storeId: req.tenantId }),
        AuditLog.distinct('entity', { storeId: req.tenantId }),
    ]);
    res.status(200).json(new ApiResponse(200, {
        logs,
        totalPages: Math.ceil(total / Number(limit)),
        currentPage: Number(page),
        distinctActions,
        distinctEntities,
    }));
});
