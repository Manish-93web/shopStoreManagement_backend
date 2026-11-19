import { Response } from 'express';
import InventoryBatch from '../models/InventoryBatch.js';
import ProductSerial from '../models/ProductSerial.js';
import StockAdjustment from '../models/StockAdjustment.js';
import Inventory from '../models/Inventory.js';
import { TenantRequest } from '../middleware/tenantHandler.js';
import ApiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import StockMovement from '../models/StockMovement.js';
import PriceHistory from '../models/PriceHistory.js';
import Product from '../models/Product.js';
import ProductVariant from '../models/ProductVariant.js';

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

    // @desc    Every stock movement of one product (purchases, sales, returns, adjustments, transfers...)
    getLedger: asyncHandler(async (req: TenantRequest, res: Response) => {
        const { productId, type, from, to } = req.query;
        if (!productId) return res.status(400).json(new ApiResponse(400, null, 'productId is required'));
        const page = parseInt(req.query.page as string) || 1;
        const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

        const query: any = { storeId: req.tenantId, product: productId };
        if (type) query.type = type;
        if (from || to) {
            query.createdAt = {};
            if (from) query.createdAt.$gte = new Date(String(from));
            if (to) query.createdAt.$lte = new Date(String(to));
        }
        const [movements, total] = await Promise.all([
            StockMovement.find(query)
                .populate('createdBy', 'name')
                .populate('variant', 'name')
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            StockMovement.countDocuments(query),
        ]);
        res.status(200).json(
            new ApiResponse(200, { movements, pagination: { total, page, limit, pages: Math.ceil(total / limit) } })
        );
    }),

    // @desc    Price changes of one product, plus its last purchase
    getPriceHistory: asyncHandler(async (req: TenantRequest, res: Response) => {
        const { productId } = req.query;
        if (!productId) return res.status(400).json(new ApiResponse(400, null, 'productId is required'));
        const [history, product] = await Promise.all([
            PriceHistory.find({ storeId: req.tenantId, product: productId })
                .populate('changedBy', 'name')
                .sort({ createdAt: -1 })
                .limit(100)
                .lean(),
            Product.findOne({ _id: productId, storeId: req.tenantId })
                .select('price mrp costPrice lastPurchasePrice lastPurchaseDate lastSupplier')
                .populate('lastSupplier', 'name')
                .lean(),
        ]);
        res.status(200).json(new ApiResponse(200, { history, product }));
    }),

    // @desc    Products that are at or below their reorder level, with how much to order
    //          Quantity to order: the fixed reorder quantity if set, else up to the max stock if set,
    //          else enough to reach twice the reorder level.
    getReorderSuggestions: asyncHandler(async (req: TenantRequest, res: Response) => {
        const low = await Inventory.find({
            store: req.tenantId,
            $expr: { $lte: ['$quantity', '$lowStockThreshold'] },
        })
            .populate({
                path: 'product',
                select: 'name sku unit costPrice isActive isCombo lastPurchasePrice lastSupplier',
                populate: { path: 'lastSupplier', select: 'name' },
            })
            .lean();

        const variantIds = low.filter((i: any) => i.variant).map((i: any) => i.variant);
        const variants = await ProductVariant.find({ _id: { $in: variantIds } })
            .select('name sku costPrice')
            .lean();
        const variantById = new Map(variants.map((v: any) => [v._id.toString(), v]));

        const suggestions = low
            .filter((i: any) => i.product && i.product.isActive !== false && !i.product.isCombo)
            .map((i: any) => {
                const level = i.lowStockThreshold ?? 0;
                let suggested: number;
                if (i.reorderQty && i.reorderQty > 0) suggested = i.reorderQty;
                else if (i.maxStock && i.maxStock > i.quantity) suggested = i.maxStock - i.quantity;
                else suggested = Math.max(level * 2 - i.quantity, 1);
                const variant: any = i.variant ? variantById.get(i.variant.toString()) : undefined;
                const cost = variant?.costPrice ?? i.product.lastPurchasePrice ?? i.product.costPrice ?? 0;
                return {
                    productId: i.product._id,
                    variantId: i.variant,
                    name: variant ? `${i.product.name} (${variant.name})` : i.product.name,
                    sku: variant?.sku || i.product.sku,
                    unit: i.product.unit,
                    quantity: i.quantity,
                    reorderLevel: level,
                    maxStock: i.maxStock,
                    suggestedQty: Math.ceil(suggested * 1000) / 1000,
                    costPrice: cost,
                    supplier: i.product.lastSupplier || null,
                };
            })
            .sort((a: any, b: any) => a.quantity - b.quantity);

        res.status(200).json(new ApiResponse(200, suggestions));
    }),

    // @desc    Look a serial / IMEI up: the product, whether it was sold, to whom, and its warranty
    lookupSerial: asyncHandler(async (req: TenantRequest, res: Response) => {
        const serial = String(req.query.serial || '').trim();
        if (!serial) return res.status(400).json(new ApiResponse(400, null, 'Enter a serial number'));
        const doc: any = await ProductSerial.findOne({ storeId: req.tenantId, serialNumber: serial })
            .populate('product', 'name sku warrantyMonths')
            .populate({
                path: 'currentOrder',
                select: 'orderNumber createdAt customer',
                populate: { path: 'customer', select: 'name phone' },
            })
            .lean();
        if (!doc) return res.status(404).json(new ApiResponse(404, null, 'No unit found with this serial number'));
        const now = Date.now();
        const warrantyExpiry = doc.warrantyExpiry ? new Date(doc.warrantyExpiry) : null;
        res.status(200).json(
            new ApiResponse(200, {
                serialNumber: doc.serialNumber,
                status: doc.status,
                product: doc.product,
                order: doc.currentOrder || null,
                warrantyExpiry,
                inWarranty: warrantyExpiry ? warrantyExpiry.getTime() >= now : null,
                history: doc.history,
            })
        );
    }),

    // @desc    Get Low Stock Alerts
    getLowStockAlerts: asyncHandler(async (req: TenantRequest, res: Response) => {
        // Find inventory where quantity <= lowStockThreshold
        const lowStockItems = (
            await Inventory.find({
                store: req.tenantId,
                $expr: { $lte: ['$quantity', '$lowStockThreshold'] },
            }).populate('product', 'name sku image barcode isCombo isActive')
        ).filter((r: any) => r.product && !r.product.isCombo && r.product.isActive !== false);

        res.status(200).json(new ApiResponse(200, lowStockItems));
    }),
};
