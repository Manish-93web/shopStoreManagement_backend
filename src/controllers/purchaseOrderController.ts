import { Response } from 'express';
import PurchaseOrder from '../models/PurchaseOrder.js';
import Inventory from '../models/Inventory.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/apiResponse.js';
import { TenantRequest } from '../middleware/tenantHandler.js';

// @desc    Create a new Purchase Order
// @route   POST /api/purchase-orders
export const createPurchaseOrder = asyncHandler(async (req: TenantRequest, res: Response) => {
    const poData = {
        ...req.body,
        poNumber: `PO-${Date.now()}`,
        storeId: req.tenantId,
        createdBy: req.user._id
    };

    const po = await PurchaseOrder.create(poData);
    res.status(201).json(new ApiResponse(201, po, "Purchase Order created"));
});

// @desc    Approve a Purchase Order
// @route   PUT /api/purchase-orders/:id/approve
export const approvePurchaseOrder = asyncHandler(async (req: TenantRequest, res: Response) => {
    const po = await PurchaseOrder.findOne({ _id: req.params.id, storeId: req.tenantId });

    if (!po) {
        return res.status(404).json(new ApiResponse(404, null, "Purchase Order not found"));
    }

    if (po.status !== 'Draft' && po.status !== 'Sent') {
        return res.status(400).json(new ApiResponse(400, null, `Cannot approve PO with status: ${po.status}`));
    }

    po.status = 'Approved';
    await po.save();

    res.status(200).json(new ApiResponse(200, po, "Purchase Order approved"));
});

// @desc    Receive inventory from approved PO
// @route   PUT /api/purchase-orders/:id/receive
export const receivePurchaseOrder = asyncHandler(async (req: TenantRequest, res: Response) => {
    const po = await PurchaseOrder.findOne({ _id: req.params.id, storeId: req.tenantId });

    if (!po || po.status === 'Received') {
        return res.status(400).json(new ApiResponse(400, null, "Invalid PO or already received"));
    }

    // Update inventory for each item
    for (const item of po.items) {
        await Inventory.findOneAndUpdate(
            { product: item.product, store: req.tenantId },
            { $inc: { quantity: item.quantity } },
            { upsert: true, returnDocument: 'after' }
        );
    }

    po.status = 'Received';
    po.receivedAt = new Date();
    await po.save();

    res.status(200).json(new ApiResponse(200, po, "Inventory received successfully"));
});

// @desc    Get all purchase orders
// @route   GET /api/purchase-orders
export const getPurchaseOrders = asyncHandler(async (req: TenantRequest, res: Response) => {
    const pos = await PurchaseOrder.find({ storeId: req.tenantId })
        .populate('supplier', 'name')
        .sort({ createdAt: -1 });
    res.status(200).json(new ApiResponse(200, pos));
});
