import { Response } from 'express';
import { customAlphabet } from 'nanoid';
import Product from '../models/Product.js';
import Inventory from '../models/Inventory.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/apiResponse.js';
import { TenantRequest } from '../middleware/tenantHandler.js';
import redisClient from '../config/redis.js';
import AuditLog from '../models/AuditLog.js';
import StockAdjustment from '../models/StockAdjustment.js';
import { notificationService } from '../services/notificationService.js';
import Store from '../models/Store.js';
import webhookService from '../services/webhookService.js';

// @desc    Get all products for a tenant
// @route   GET /api/products
export const getProducts = asyncHandler(async (req: TenantRequest, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    const { search, category, brand, stockStatus } = req.query;

    const query: any = { storeId: req.tenantId };
    
    if (category && category !== 'All') query.category = category;
    if (brand && brand !== 'All') query.brand = brand;
    if (search) {
        query.$or = [
            { name: { $regex: search, $options: 'i' } },
            { sku: { $regex: search, $options: 'i' } },
            { barcode: { $regex: search, $options: 'i' } }
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
        const productIds = matchingInventories.map(inv => inv.product);
        query._id = { $in: productIds };
    }

    const products = await Product.find(query)
        .populate('category')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .lean();

    const productIds = products.map(p => p._id);
    const inventories = await Inventory.find({ product: { $in: productIds }, store: req.tenantId });
    const inventoryMap = new Map(inventories.map(inv => [inv.product.toString(), inv]));

    const productsWithInventory = products.map(p => ({
        ...p,
        inventory: inventoryMap.get(p._id.toString())
    }));

    const total = await Product.countDocuments(query);

    const response = {
        products: productsWithInventory,
        pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit)
        }
    };

    res.status(200).json(new ApiResponse(200, response));
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
            return res.status(403).json(new ApiResponse(403, null, `Product limit reached. Your current plan "${plan.name}" allows up to ${plan.maxProducts} products.`));
        }
    }

    const productData = { ...req.body, storeId: req.tenantId };
    if (!productData.barcode) {
        const generateBarcode = customAlphabet('0123456789', 12);
        productData.barcode = generateBarcode();
    }
    const product = await Product.create(productData);
    if (process.env.SKIP_REDIS !== 'true') {
        await redisClient.del(`products:${req.tenantId}`);
    }
    await Inventory.create({
        product: product._id,
        store: req.tenantId,
        quantity: req.body.initialStock || 0
    });

    // Audit Log
    await AuditLog.create({
        userId: req.user?._id,
        storeId: req.tenantId,
        action: 'CREATED_PRODUCT',
        entity: 'Product',
        entityId: product._id as any,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
    });

    // Trigger Webhooks
    webhookService.trigger('product.created', req.tenantId!.toString(), product);

    res.status(201).json(new ApiResponse(201, product, "Product created successfully"));
});

// @desc    Update product
// @route   PUT /api/products/:id
export const updateProduct = asyncHandler(async (req: TenantRequest, res: Response) => {
    const product = await Product.findOneAndUpdate(
        { _id: req.params.id, storeId: req.tenantId },
        req.body,
    );
    if (!product) return res.status(404).json(new ApiResponse(404, null, "Product not found"));

    if (process.env.SKIP_REDIS !== 'true') {
        await redisClient.del(`products:${req.tenantId}`);
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
        userAgent: req.headers['user-agent']
    });

    // Trigger Webhooks
    webhookService.trigger('product.updated', req.tenantId!.toString(), product);

    res.status(200).json(new ApiResponse(200, product, "Product updated successfully"));
});

// @desc    Delete product
// @route   DELETE /api/products/:id
export const deleteProduct = asyncHandler(async (req: TenantRequest, res: Response) => {
    const product = await Product.findOneAndDelete({ _id: req.params.id, storeId: req.tenantId });
    if (!product) return res.status(404).json(new ApiResponse(404, null, "Product not found"));

    await Inventory.deleteMany({ product: req.params.id });

    if (process.env.SKIP_REDIS !== 'true') {
        await redisClient.del(`products:${req.tenantId}`);
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
        userAgent: req.headers['user-agent']
    });

    res.status(200).json(new ApiResponse(200, null, "Product deleted successfully"));
});

// @desc    Manually adjust stock for a product
// @route   PATCH /api/products/:id/adjust
export const adjustStock = asyncHandler(async (req: TenantRequest, res: Response) => {
    const { quantity, reason, notes } = req.body;

    // First, get current inventory
    const currentInv = await Inventory.findOne({ product: req.params.id, store: req.tenantId });
    const previousQuantity = currentInv ? currentInv.quantity : 0;
    const newQuantity = previousQuantity + quantity;

    const inv = await Inventory.findOneAndUpdate(
        { product: req.params.id, store: req.tenantId },
        { $inc: { quantity } },
        { returnDocument: 'after', upsert: true }
    );

    // Write audit trail to StockAdjustment
    await StockAdjustment.create({
        storeId: req.tenantId,
        productId: req.params.id as any,
        previousQuantity,
        newQuantity,
        adjustmentAmount: quantity,
        reason: reason || 'Correction',
        notes: notes || '',
        createdBy: req.user?._id
    });

    // Invalidate cache
    // 3. Check for Low Stock Notification
    if (newQuantity <= 5) {
        const store = await Store.findById(req.tenantId);
        const product = await Product.findById(req.params.id);
        if (store && product) {
            await notificationService.send({
                recipientId: store.owner.toString(),
                storeId: req.tenantId!.toString(),
                title: `Low Stock Alert`,
                message: `"${product.name}" is running low (${newQuantity} units remaining).`,
                type: 'WARNING',
                metadata: { productId: product._id }
            });
        }
    }

    res.status(200).json(new ApiResponse(200, { inventory: inv, reason }, 'Stock adjusted'));
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
    if (!Array.isArray(productsData)) return res.status(400).json(new ApiResponse(400, null, "Invalid data format"));
    const results = { success: 0, failed: 0, errors: [] as any[] };
    const generateBarcode = customAlphabet('0123456789', 12);
    for (const data of productsData) {
        try {
            if (maxProducts !== 0 && currentCount >= maxProducts) {
                throw new Error(`Plan limit of ${maxProducts} products reached.`);
            }
            const product = await Product.create({ ...data, storeId: req.tenantId, barcode: data.barcode || generateBarcode() });
            await Inventory.create({ product: product._id, store: req.tenantId, quantity: data.initialStock || 0 });
            results.success++;
            currentCount++;
        } catch (error: any) {
            results.failed++;
            results.errors.push({ name: data.name, error: error.message });
        }
    }
    if (process.env.SKIP_REDIS !== 'true') {
        await redisClient.del(`products:${req.tenantId}`);
    }
    res.status(200).json(new ApiResponse(200, results, `Imported ${results.success} products`));
});

// @desc    Bulk update products
// @route   PUT /api/products/bulk
export const bulkUpdateProducts = asyncHandler(async (req: TenantRequest, res: Response) => {
    const productsData = req.body;
    if (!Array.isArray(productsData)) return res.status(400).json(new ApiResponse(400, null, "Invalid data format"));

    const results = { success: 0, failed: 0, errors: [] as any[] };

    for (const data of productsData) {
        try {
            if (!data._id) throw new Error("Product ID is required for bulk update");
            await Product.findOneAndUpdate({ _id: data._id, storeId: req.tenantId }, data);
            results.success++;
        } catch (error: any) {
            results.failed++;
            results.errors.push({ id: data._id, error: error.message });
        }
    }

    if (process.env.SKIP_REDIS !== 'true') {
        await redisClient.del(`products:${req.tenantId}`);
    }

    await AuditLog.create({
        userId: req.user?._id,
        storeId: req.tenantId,
        action: 'UPDATED_PRODUCT',
        entity: 'Product',
        details: `Bulk updated ${results.success} products.`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
    });

    res.status(200).json(new ApiResponse(200, results, `Updated ${results.success} products`));
});
