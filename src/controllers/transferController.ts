import { Request, Response } from 'express';
import Transfer from '../models/Transfer.js';
import Inventory from '../models/Inventory.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/apiResponse.js';
import { TenantRequest } from '../middleware/tenantHandler.js';

// @desc    Create a stock transfer request
// @route   POST /api/transfers
export const createTransfer = asyncHandler(async (req: TenantRequest, res: Response) => {
    const { toStore, items } = req.body;

    const transfer = await Transfer.create({
        transferNumber: `TRF-${Date.now()}`,
        fromStore: req.tenantId,
        toStore,
        items,
        createdBy: req.user._id
    });

    res.status(201).json(new ApiResponse(201, transfer, "Transfer request created"));
});

// @desc    Approve the transfer request
// @route   PUT /api/transfers/:id/approve
export const approveTransfer = asyncHandler(async (req: TenantRequest, res: Response) => {
    const transfer = await Transfer.findById(req.params.id);

    if (!transfer || transfer.status !== 'Pending') {
        return res.status(400).json(new ApiResponse(400, null, "Invalid transfer status"));
    }

    transfer.status = 'Approved';
    transfer.approvedAt = new Date();
    transfer.approvedBy = req.user._id;
    await transfer.save();

    res.status(200).json(new ApiResponse(200, transfer, "Transfer approved"));
});

// @desc    Ship the transfer (deduce stock)
// @route   PUT /api/transfers/:id/ship
export const shipTransfer = asyncHandler(async (req: TenantRequest, res: Response) => {
    const transfer = await Transfer.findOne({ _id: req.params.id, fromStore: req.tenantId });

    if (!transfer || transfer.status !== 'Approved') {
        return res.status(400).json(new ApiResponse(400, null, "Transfer must be approved before shipping"));
    }

    // Reduce inventory from 'fromStore'
    for (const item of transfer.items) {
        await Inventory.findOneAndUpdate(
            { product: item.product, variant: item.variant, store: req.tenantId },
            { $inc: { quantity: -item.quantity } }
        );
    }

    transfer.status = 'Shipped';
    transfer.shippedAt = new Date();
    transfer.shippedBy = req.user._id;
    await transfer.save();

    res.status(200).json(new ApiResponse(200, transfer, "Transfer items shipped"));
});

// @desc    Receive the transfer at destination store (add stock)
// @route   PUT /api/transfers/:id/receive
export const receiveTransfer = asyncHandler(async (req: TenantRequest, res: Response) => {
    const transfer = await Transfer.findOne({ _id: req.params.id, toStore: req.tenantId });

    if (!transfer || transfer.status !== 'Shipped') {
        return res.status(400).json(new ApiResponse(400, null, "Transfer must be shipped before receiving"));
    }

    // Increase inventory at 'toStore'
    for (const item of transfer.items) {
        await Inventory.findOneAndUpdate(
            { product: item.product, variant: item.variant, store: req.tenantId },
            { $inc: { quantity: item.quantity } },
            { upsert: true }
        );
    }

    transfer.status = 'Received';
    transfer.receivedAt = new Date();
    transfer.receivedBy = req.user._id;
    await transfer.save();

    res.status(200).json(new ApiResponse(200, transfer, "Transfer items received"));
});

// @desc    Get transfers for current store (Sent or Received)
// @route   GET /api/transfers
export const getTransfers = asyncHandler(async (req: TenantRequest, res: Response) => {
    const transfers = await Transfer.find({
        $or: [{ fromStore: req.tenantId }, { toStore: req.tenantId }]
    }).populate('fromStore toStore', 'name');

    res.status(200).json(new ApiResponse(200, transfers));
});
