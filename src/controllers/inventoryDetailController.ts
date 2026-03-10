import { Response } from 'express';
import InventoryBatch from '../models/InventoryBatch.js';
import ProductSerial from '../models/ProductSerial.js';
import StockAdjustment from '../models/StockAdjustment.js';
import Inventory from '../models/Inventory.js';
import { TenantRequest } from '../middleware/tenantHandler.js';
import ApiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

export const inventoryDetailController = {
    // @desc    Get batches for a product
    getBatches: asyncHandler(async (req: TenantRequest, res: Response) => {
        const { productId, variantId } = req.query;
        const query: any = {
            storeId: req.tenantId,
            product: productId,
            status: 'Active'
        };
        if (variantId) query.variant = variantId;

        const batches = await InventoryBatch.find(query).sort({ expiryDate: 1 });
        res.status(200).json(new ApiResponse(200, batches));
    }),

    // @desc    Get serial numbers for a product
    getSerials: asyncHandler(async (req: TenantRequest, res: Response) => {
        const { productId, variantId } = req.query;
        const query: any = {
            storeId: req.tenantId,
            product: productId,
            status: 'In Stock'
        };
        if (variantId) query.variant = variantId;

        const serials = await ProductSerial.find(query);
        res.status(200).json(new ApiResponse(200, serials));
    }),

    // @desc    Update serial status
    updateSerialStatus: asyncHandler(async (req: TenantRequest, res: Response) => {
        const { serialNumber, status, notes } = req.body;
        const serial = await ProductSerial.findOneAndUpdate(
            { serialNumber, storeId: req.tenantId },
            {
                $set: { status },
                $push: { history: { action: `Status changed to ${status}`, notes, date: new Date() } }
            },
            { new: true }
        );
        if (!serial) return res.status(404).json(new ApiResponse(404, null, "Serial not found"));
        res.status(200).json(new ApiResponse(200, serial, "Serial status updated"));
    }),

    // @desc    Get Stock History Log
    getStockHistory: asyncHandler(async (req: TenantRequest, res: Response) => {
        const { productId } = req.query;
        const query: any = { storeId: req.tenantId };
        if (productId) query.productId = productId;

        const history = await StockAdjustment.find(query)
            .populate('createdBy', 'firstName lastName email')
            .populate('productId', 'name sku')
            .sort({ createdAt: -1 })
            .limit(50); // limit to recent 50 for performance

        res.status(200).json(new ApiResponse(200, history));
    }),

    // @desc    Get Low Stock Alerts
    getLowStockAlerts: asyncHandler(async (req: TenantRequest, res: Response) => {
        // Find inventory where quantity <= lowStockThreshold
        const lowStockItems = await Inventory.find({
            store: req.tenantId,
            $expr: { $lte: ['$quantity', '$lowStockThreshold'] }
        }).populate('product', 'name sku image barcode');

        res.status(200).json(new ApiResponse(200, lowStockItems));
    })
};
