import Transfer from '../models/Transfer.js';
import Inventory from '../models/Inventory.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/apiResponse.js';
import { bumpCacheVersion } from '../config/redis.js';
import { emitToStore } from '../config/socket.js';
// @desc    Create a stock transfer request
// @route   POST /api/transfers
export const createTransfer = asyncHandler(async (req, res) => {
    const { toStore, items } = req.body;
    const transfer = await Transfer.create({
        transferNumber: `TRF-${Date.now()}`,
        fromStore: req.tenantId,
        toStore,
        items,
        createdBy: req.user._id,
    });
    res.status(201).json(new ApiResponse(201, transfer, 'Transfer request created'));
});
// @desc    Approve the transfer request
// @route   PUT /api/transfers/:id/approve
export const approveTransfer = asyncHandler(async (req, res) => {
    const transfer = await Transfer.findById(req.params.id);
    if (!transfer || transfer.status !== 'Pending') {
        return res.status(400).json(new ApiResponse(400, null, 'Invalid transfer status'));
    }
    transfer.status = 'Approved';
    transfer.approvedAt = new Date();
    transfer.approvedBy = req.user._id;
    await transfer.save();
    res.status(200).json(new ApiResponse(200, transfer, 'Transfer approved'));
});
// @desc    Ship the transfer (deduce stock)
// @route   PUT /api/transfers/:id/ship
export const shipTransfer = asyncHandler(async (req, res) => {
    const transfer = await Transfer.findOne({ _id: req.params.id, fromStore: req.tenantId });
    if (!transfer || transfer.status !== 'Approved') {
        return res.status(400).json(new ApiResponse(400, null, 'Transfer must be approved before shipping'));
    }
    // Reduce inventory from 'fromStore'
    for (const item of transfer.items) {
        const inv = await Inventory.findOneAndUpdate({ product: item.product, variant: item.variant, store: req.tenantId }, { $inc: { quantity: -item.quantity } }, { new: true });
        emitToStore(req.tenantId.toString(), 'inventory-update', {
            productId: item.product,
            variantId: item.variant,
            newQuantity: inv?.quantity,
        });
    }
    await bumpCacheVersion(req.tenantId.toString());
    transfer.status = 'Shipped';
    transfer.shippedAt = new Date();
    transfer.shippedBy = req.user._id;
    await transfer.save();
    res.status(200).json(new ApiResponse(200, transfer, 'Transfer items shipped'));
});
// @desc    Receive the transfer at destination store (add stock)
// @route   PUT /api/transfers/:id/receive
export const receiveTransfer = asyncHandler(async (req, res) => {
    const transfer = await Transfer.findOne({ _id: req.params.id, toStore: req.tenantId });
    if (!transfer || transfer.status !== 'Shipped') {
        return res.status(400).json(new ApiResponse(400, null, 'Transfer must be shipped before receiving'));
    }
    // Increase inventory at 'toStore'
    for (const item of transfer.items) {
        const inv = await Inventory.findOneAndUpdate({ product: item.product, variant: item.variant, store: req.tenantId }, { $inc: { quantity: item.quantity } }, { upsert: true, new: true });
        emitToStore(req.tenantId.toString(), 'inventory-update', {
            productId: item.product,
            variantId: item.variant,
            newQuantity: inv?.quantity,
        });
    }
    await bumpCacheVersion(req.tenantId.toString());
    transfer.status = 'Received';
    transfer.receivedAt = new Date();
    transfer.receivedBy = req.user._id;
    await transfer.save();
    res.status(200).json(new ApiResponse(200, transfer, 'Transfer items received'));
});
// @desc    Get transfers for current store (Sent or Received)
// @route   GET /api/transfers
export const getTransfers = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status?.trim();
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const query = {
        $or: [{ fromStore: req.tenantId }, { toStore: req.tenantId }],
    };
    if (status)
        query.status = status;
    if (startDate && endDate) {
        query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    const [transfers, total] = await Promise.all([
        Transfer.find(query).populate('fromStore toStore', 'name').sort({ createdAt: -1 }).skip(skip).limit(limit),
        Transfer.countDocuments(query),
    ]);
    res.status(200).json(new ApiResponse(200, {
        transfers,
        pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
        },
    }));
});
