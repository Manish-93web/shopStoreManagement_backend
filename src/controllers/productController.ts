import { Response } from 'express';
import mongoose from 'mongoose';
import { customAlphabet } from 'nanoid';
import Product from '../models/Product.js';
import Inventory from '../models/Inventory.js';
import ProductVariant from '../models/ProductVariant.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/apiResponse.js';
import { TenantRequest } from '../middleware/tenantHandler.js';
import redisClient, { getCacheVersion, bumpCacheVersion } from '../config/redis.js';
import AuditLog from '../models/AuditLog.js';
import StockAdjustment from '../models/StockAdjustment.js';
import { notificationService } from '../services/notificationService.js';
import Store from '../models/Store.js';
import webhookService from '../services/webhookService.js';
import Category from '../models/Category.js';
import { emitToStore } from '../config/socket.js';

// @desc    Get all products for a tenant
// @route   GET /api/products
export const getProducts = asyncHandler(async (req: TenantRequest, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    const { search, category, brand, stockStatus } = req.query;

    const cacheVersion = await getCacheVersion(req.tenantId!.toString());
    const cacheKey = `products:${req.tenantId}:v${cacheVersion}:${JSON.stringify({ search, category, brand, stockStatus, page, limit })}`;
    if (process.env.SKIP_REDIS !== 'true') {
        const cached = await redisClient.get(cacheKey);
        if (cached) return res.status(200).json(new ApiResponse(200, JSON.parse(cached), 'Products from cache'));
    }

    const query: any = { storeId: req.tenantId };

    if (category && category !== 'All') {
        const getSubCategoryIds = async (parentId: string): Promise<string[]> => {
            const children = await Category.find({ parentId, storeId: req.tenantId }).select('_id');
            let ids = [parentId];
            for (const child of children) {
                const childIds = await getSubCategoryIds(child._id.toString());
                ids = [...ids, ...childIds];
            }
            return ids;
        };
        const allCategoryIds = await getSubCategoryIds(category as string);
        query.category = { $in: allCategoryIds };
    }

    if (brand && brand !== 'All') query.brand = brand;
    if (search) {
        query.$or = [
            { name: { $regex: search, $options: 'i' } },
            { sku: { $regex: search, $options: 'i' } },
            { barcode: { $regex: search, $options: 'i' } },
        ];
    }

    // Handle stock status filtering (requires looking at Inventory)
    if (stockStatus) {
        const invQuery: any = { store: req.tenantId };
        if (stockStatus === 'low') {
            invQuery.$expr = { $lte: ['$quantity', '$lowStockThreshold'] };
        } else if (stockStatus === 'out') {
            invQuery.quantity = 0;
        }

        const matchingInventories = await Inventory.find(invQuery).select('product');
        const productIds = matchingInventories.map((inv) => inv.product);
        query._id = { $in: productIds };
    }

    const products = await Product.find(query)
        .populate('category')
        .populate('taxRule')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .lean();

    const productIds = products.map((p) => p._id);
    const inventories = await Inventory.find({ product: { $in: productIds }, store: req.tenantId });
    const inventoryMap = new Map(inventories.map((inv) => [inv.product.toString(), inv]));

    const productsWithInventory = products.map((p: any) => ({
        ...p,
        inventory: inventoryMap.get(p._id.toString()),
        // A linked Percentage tax rule overrides the flat taxRate; a Fixed-amount rule
        // isn't supported end-to-end by the order/GST-split pipeline yet, so it falls
        // back to the flat rate rather than silently mis-computing tax.
        effectiveTaxRate: p.taxRule && p.taxRule.type === 'Percentage' ? p.taxRule.rate : p.taxRate,
    }));

    const total = await Product.countDocuments(query);

    const response = {
        products: productsWithInventory,
        pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
        },
    };

    if (process.env.SKIP_REDIS !== 'true') {
        // Shorter TTL than customers/orders (300s) since stock changes on every sale.
        await redisClient.setEx(cacheKey, 60, JSON.stringify(response));
    }

    res.status(200).json(new ApiResponse(200, response));
});

// @desc    Get a single product with its inventory, variants, and recent activity
// @route   GET /api/products/:id
export const getProductById = asyncHandler(async (req: TenantRequest, res: Response) => {
    const product = await Product.findOne({ _id: req.params.id, storeId: req.tenantId })
        .populate('category')
        .populate('taxRule');
    if (!product) {
        return res.status(404).json(new ApiResponse(404, null, 'Product not found'));
    }

    const [inventory, variants, activityLog] = await Promise.all([
        Inventory.findOne({ product: product._id, store: req.tenantId }),
        ProductVariant.find({ product: product._id }),
        AuditLog.find({ storeId: req.tenantId, entity: 'Product', entityId: product._id })
            .populate('userId', 'name')
            .sort({ createdAt: -1 })
            .limit(20),
    ]);

    res.status(200).json(new ApiResponse(200, { product, inventory, variants, activityLog }));
});

// @desc    Create a new product
// @route   POST /api/products
export const createProduct = asyncHandler(async (req: TenantRequest, res: Response) => {
    // Check Plan Limits
    const store = await Store.findById(req.tenantId).populate('subscriptionPlan');
    if (store && store.subscriptionPlan) {
        const plan = store.subscriptionPlan as any;
        const currentCount = await Product.countDocuments({ storeId: req.tenantId });
        if (plan.maxProducts !== 0 && currentCount >= plan.maxProducts) {
            return res
                .status(403)
                .json(
                    new ApiResponse(
                        403,
                        null,
                        `Product limit reached. Your current plan "${plan.name}" allows up to ${plan.maxProducts} products.`
                    )
                );
        }
    }

    const productData = { ...req.body, storeId: req.tenantId };
    if (!productData.barcode) {
        const generateBarcode = customAlphabet('0123456789', 12);
        productData.barcode = generateBarcode();
    }
    const product = await Product.create(productData);
    if (process.env.SKIP_REDIS !== 'true') {
        await bumpCacheVersion(req.tenantId!.toString());
    }
    await Inventory.create({
        product: product._id,
        store: req.tenantId,
        quantity: req.body.initialStock || 0,
    });

    // Audit Log
    await AuditLog.create({
        userId: req.user?._id,
        storeId: req.tenantId,
        action: 'CREATED_PRODUCT',
        entity: 'Product',
        entityId: product._id as any,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
    });

    // Trigger Webhooks
    webhookService.trigger('product.created', req.tenantId!.toString(), product);

    res.status(201).json(new ApiResponse(201, product, 'Product created successfully'));
});

// @desc    Update product
// @route   PUT /api/products/:id
export const updateProduct = asyncHandler(async (req: TenantRequest, res: Response) => {
    const product = await Product.findOneAndUpdate({ _id: req.params.id, storeId: req.tenantId }, req.body, {
        returnDocument: 'after',
    }).populate('taxRule');
    if (!product) return res.status(404).json(new ApiResponse(404, null, 'Product not found'));

    if (process.env.SKIP_REDIS !== 'true') {
        await bumpCacheVersion(req.tenantId!.toString());
    }

    // Audit Log
    await AuditLog.create({
        userId: req.user?._id,
        storeId: req.tenantId,
        action: 'UPDATED_PRODUCT',
        entity: 'Product',
        entityId: product._id as any,
        details: `Product "${product.name}" updated.`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
    });

    // Trigger Webhooks
    webhookService.trigger('product.updated', req.tenantId!.toString(), product);

    res.status(200).json(new ApiResponse(200, product, 'Product updated successfully'));
});

// @desc    Delete product
// @route   DELETE /api/products/:id
export const deleteProduct = asyncHandler(async (req: TenantRequest, res: Response) => {
    const product = await Product.findOneAndDelete({ _id: req.params.id, storeId: req.tenantId });
    if (!product) return res.status(404).json(new ApiResponse(404, null, 'Product not found'));

    await Inventory.deleteMany({ product: req.params.id });

    if (process.env.SKIP_REDIS !== 'true') {
        await bumpCacheVersion(req.tenantId!.toString());
    }

    // Audit Log
    await AuditLog.create({
        userId: req.user?._id,
        storeId: req.tenantId,
        action: 'DELETED_PRODUCT',
        entity: 'Product',
        entityId: product._id as any,
        details: `Product "${product.name}" deleted.`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
    });

    res.status(200).json(new ApiResponse(200, null, 'Product deleted successfully'));
});

const VALID_ADJUSTMENT_REASONS = ['Damaged', 'Correction', 'Restock', 'Expire', 'Other'];

// @desc    Adjust stock level
// @route   PATCH /api/products/:id/adjust
export const adjustStock = asyncHandler(async (req: TenantRequest, res: Response) => {
    const { quantity, reason, type } = req.body;
    const adjustQty = type === 'add' ? quantity : -quantity;
    const adjustmentReason = reason || 'Correction';

    // Validate before touching data — an invalid reason used to fail *after* the
    // inventory quantity was already incremented (no transaction), leaving the
    // stock changed with no matching audit record. Fail fast instead.
    if (!VALID_ADJUSTMENT_REASONS.includes(adjustmentReason)) {
        return res
            .status(400)
            .json(new ApiResponse(400, null, `Invalid reason. Must be one of: ${VALID_ADJUSTMENT_REASONS.join(', ')}`));
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    let inv;
    try {
        inv = await Inventory.findOneAndUpdate(
            { product: req.params.id, store: req.tenantId },
            {
                $inc: { quantity: adjustQty },
                $set: { lastStockUpdate: new Date() },
            },
            { new: true, upsert: true, session }
        );

        // Track the adjustment
        await StockAdjustment.create(
            [
                {
                    productId: req.params.id as any,
                    storeId: req.tenantId as any,
                    previousQuantity: (inv?.quantity || 0) - adjustQty,
                    newQuantity: inv?.quantity || 0,
                    adjustmentAmount: adjustQty,
                    type: type === 'add' ? 'ADD' : 'SUBTRACT',
                    reason: adjustmentReason,
                    notes: req.body.notes || '',
                    createdBy: req.user?._id,
                },
            ],
            { session }
        );

        await session.commitTransaction();
    } catch (err) {
        await session.abortTransaction();
        throw err;
    } finally {
        session.endSession();
    }

    // Invalidate cache
    if (process.env.SKIP_REDIS !== 'true') {
        await bumpCacheVersion(req.tenantId!.toString());
    }

    // Notify clients about stock change
    emitToStore(req.tenantId!.toString(), 'inventory-update', {
        productId: req.params.id,
        variantId: undefined,
        newQuantity: inv?.quantity,
    });

    // 3. Check for Low Stock Notification
    if (inv && inv.quantity <= (inv.lowStockThreshold || 5)) {
        const store = await Store.findById(req.tenantId);
        const product = await Product.findById(req.params.id);
        if (store && product) {
            await notificationService.send({
                recipientId: store.owner.toString(),
                storeId: req.tenantId!.toString(),
                title: `Low Stock Alert`,
                message: `"${product.name}" is running low (${inv.quantity} units remaining).`,
                type: 'WARNING',
                metadata: { productId: product._id },
            });
        }
    }

    res.status(200).json(new ApiResponse(200, { inventory: inv, reason: adjustmentReason }, 'Stock adjusted'));
});

// @desc    Bulk import products
// @route   POST /api/products/bulk
export const bulkImportProducts = asyncHandler(async (req: TenantRequest, res: Response) => {
    // Check Plan Limits
    const store = await Store.findById(req.tenantId).populate('subscriptionPlan');
    let maxProducts = 0;
    let currentCount = 0;
    if (store && store.subscriptionPlan) {
        const plan = store.subscriptionPlan as any;
        maxProducts = plan.maxProducts;
        currentCount = await Product.countDocuments({ storeId: req.tenantId });
    }

    const productsData = req.body;
    if (!Array.isArray(productsData)) return res.status(400).json(new ApiResponse(400, null, 'Invalid data format'));
    const results = { success: 0, failed: 0, errors: [] as any[] };
    const generateBarcode = customAlphabet('0123456789', 12);
    for (const data of productsData) {
        try {
            if (maxProducts !== 0 && currentCount >= maxProducts) {
                throw new Error(`Plan limit of ${maxProducts} products reached.`);
            }
            const product = await Product.create({
                ...data,
                storeId: req.tenantId,
                barcode: data.barcode || generateBarcode(),
            });
            await Inventory.create({ product: product._id, store: req.tenantId, quantity: data.initialStock || 0 });
            results.success++;
            currentCount++;
        } catch (error: any) {
            results.failed++;
            results.errors.push({ name: data.name, error: error.message });
        }
    }
    if (process.env.SKIP_REDIS !== 'true') {
        await bumpCacheVersion(req.tenantId!.toString());
    }
    res.status(200).json(new ApiResponse(200, results, `Imported ${results.success} products`));
});

// @desc    Bulk update products
// @route   PUT /api/products/bulk
export const bulkUpdateProducts = asyncHandler(async (req: TenantRequest, res: Response) => {
    const productsData = req.body;
    if (!Array.isArray(productsData)) return res.status(400).json(new ApiResponse(400, null, 'Invalid data format'));

    const results = { success: 0, failed: 0, errors: [] as any[] };

    for (const data of productsData) {
        try {
            if (!data._id) throw new Error('Product ID is required for bulk update');
            await Product.findOneAndUpdate({ _id: data._id, storeId: req.tenantId }, data);
            results.success++;
        } catch (error: any) {
            results.failed++;
            results.errors.push({ id: data._id, error: error.message });
        }
    }

    if (process.env.SKIP_REDIS !== 'true') {
        await bumpCacheVersion(req.tenantId!.toString());
    }

    await AuditLog.create({
        userId: req.user?._id,
        storeId: req.tenantId,
        action: 'UPDATED_PRODUCT',
        entity: 'Product',
        details: `Bulk updated ${results.success} products.`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
    });

    res.status(200).json(new ApiResponse(200, results, `Updated ${results.success} products`));
});
