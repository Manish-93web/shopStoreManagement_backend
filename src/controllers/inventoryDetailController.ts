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
            status: 'Active',
        };
        if (variantId) query.variant = variantId;

        const batches = await InventoryBatch.find(query).sort({ expiryDate: 1 });
        res.status(200).json(new ApiResponse(200, batches));
    }),

    // @desc    Record a new batch for stock on hand (manual entry, or called
    //          from PO receiving when the received items include batch info)
    createBatch: asyncHandler(async (req: TenantRequest, res: Response) => {
        const {
            product,
            variant,
            batchNumber,
            quantity,
            costPrice,
            sellingPrice,
            manufacturingDate,
            expiryDate,
            supplier,
            purchaseOrder,
        } = req.body;

        if (!product || !batchNumber || quantity === undefined || costPrice === undefined) {
            return res
                .status(400)
                .json(new ApiResponse(400, null, 'product, batchNumber, quantity, and costPrice are required'));
        }

        const batch = await InventoryBatch.create({
            batchNumber,
            product,
            variant: variant || undefined,
            storeId: req.tenantId,
            supplier: supplier || undefined,
            purchaseOrder: purchaseOrder || undefined,
            initialQuantity: quantity,
            currentQuantity: quantity,
            costPrice,
            sellingPrice: sellingPrice || undefined,
            manufacturingDate: manufacturingDate || undefined,
            expiryDate: expiryDate || undefined,
        });

        res.status(201).json(new ApiResponse(201, batch, 'Batch recorded'));
    }),

    // @desc    Get serial numbers for a product
    getSerials: asyncHandler(async (req: TenantRequest, res: Response) => {
        const { productId, variantId } = req.query;
        const query: any = {
            storeId: req.tenantId,
            product: productId,
            status: 'In Stock',
        };
        if (variantId) query.variant = variantId;

        const serials = await ProductSerial.find(query);
        res.status(200).json(new ApiResponse(200, serials));
    }),

    // @desc    Record one or more serial numbers for stock on hand
    //          (accepts a single serialNumber or a serialNumbers[] array —
    //          serialized units are usually added several at a time)
    createSerials: asyncHandler(async (req: TenantRequest, res: Response) => {
        const { product, variant, batch, warrantyExpiry } = req.body;
        const serialNumbers: string[] =
            req.body.serialNumbers || (req.body.serialNumber ? [req.body.serialNumber] : []);

        if (!product || serialNumbers.length === 0) {
            return res
                .status(400)
                .json(new ApiResponse(400, null, 'product and at least one serial number are required'));
        }

        const docs = serialNumbers.map((serialNumber) => ({
            serialNumber,
            product,
            variant: variant || undefined,
            storeId: req.tenantId,
            batch: batch || undefined,
            warrantyExpiry: warrantyExpiry || undefined,
            history: [{ action: 'Added to stock', date: new Date() }],
        }));

        try {
            const created = await ProductSerial.insertMany(docs, { ordered: false });
            res.status(201).json(new ApiResponse(201, created, `${created.length} serial number(s) recorded`));
        } catch (err: any) {
            // insertMany with ordered:false still throws on any failure (e.g. duplicate
            // serial) after inserting the valid ones — report what succeeded.
            if (err.insertedDocs?.length) {
                return res
                    .status(207)
                    .json(
                        new ApiResponse(
                            207,
                            err.insertedDocs,
                            `${err.insertedDocs.length} recorded, some were duplicates and skipped`
                        )
                    );
            }
            throw err;
        }
    }),

    // @desc    Update serial status
    updateSerialStatus: asyncHandler(async (req: TenantRequest, res: Response) => {
        const { serialNumber, status, notes } = req.body;
        const serial = await ProductSerial.findOneAndUpdate(
            { serialNumber, storeId: req.tenantId },
            {
                $set: { status },
                $push: { history: { action: `Status changed to ${status}`, notes, date: new Date() } },
            },
            { returnDocument: 'after' }
        );
        if (!serial) return res.status(404).json(new ApiResponse(404, null, 'Serial not found'));
        res.status(200).json(new ApiResponse(200, serial, 'Serial status updated'));
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
            $expr: { $lte: ['$quantity', '$lowStockThreshold'] },
        }).populate('product', 'name sku image barcode');

        res.status(200).json(new ApiResponse(200, lowStockItems));
    }),
};
