import { Response } from 'express';
import mongoose from 'mongoose';
import StockCount from '../models/StockCount.js';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import Inventory from '../models/Inventory.js';
import ProductVariant from '../models/ProductVariant.js';
import StockAdjustment from '../models/StockAdjustment.js';
import AuditLog from '../models/AuditLog.js';
import ApiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { TenantRequest } from '../middleware/tenantHandler.js';
import { bumpCacheVersion } from '../config/redis.js';
import { emitToStore } from '../config/socket.js';
import { recordStockMovement } from '../utils/stockMovement.js';

// Inventory row for a counted line: the variant's own row, or the base product's row.
const inventoryFilter = (storeId: any, item: { product: any; variant?: any }) =>
    item.variant
        ? { store: storeId, product: item.product, variant: item.variant }
        : { store: storeId, product: item.product, variant: { $exists: false } };

// @desc    Start a stock count — snapshots the current system quantity of every (optionally category-filtered) product
// @route   POST /api/stock-counts
export const createStockCount = asyncHandler(async (req: TenantRequest, res: Response) => {
    const { title, categoryId, notes } = req.body;

    const productQuery: any = { storeId: req.tenantId, isActive: { $ne: false } };
    if (categoryId && categoryId !== 'All') {
        // The category plus all of its sub-categories.
        const children = await Category.find({ parentId: categoryId, storeId: req.tenantId }).select('_id');
        productQuery.category = { $in: [categoryId, ...children.map((c) => c._id)] };
    }
    const products = await Product.find(productQuery).select('name sku unit hasVariants').sort({ name: 1 }).lean();
    if (products.length === 0) {
        return res.status(400).json(new ApiResponse(400, null, 'There are no products to count.'));
    }

    // Stock of a product with variants lives on each variant (size / colour), so those are counted one by one.
    const inventories = await Inventory.find({
        store: req.tenantId,
        product: { $in: products.map((p) => p._id) },
    }).lean();
    const qtyOf = new Map(inventories.map((i) => [`${i.product}:${i.variant || ''}`, i.quantity]));
    const variants = await ProductVariant.find({
        productId: { $in: products.filter((p: any) => p.hasVariants).map((p) => p._id) },
        storeId: req.tenantId,
        isActive: { $ne: false },
    })
        .select('name sku productId')
        .sort({ name: 1 })
        .lean();
    const variantsOf = new Map<string, any[]>();
    for (const v of variants)
        variantsOf.set(v.productId.toString(), [...(variantsOf.get(v.productId.toString()) || []), v]);

    const lines = products.flatMap((p: any) => {
        const vs = p.hasVariants ? variantsOf.get(p._id.toString()) : undefined;
        if (vs && vs.length > 0) {
            return vs.map((v: any) => ({
                product: p._id,
                variant: v._id,
                name: `${p.name} (${v.name})`,
                sku: v.sku,
                unit: p.unit || 'pcs',
                systemQty: qtyOf.get(`${p._id}:${v._id}`) ?? 0,
            }));
        }
        return [
            {
                product: p._id,
                name: p.name,
                sku: p.sku,
                unit: p.unit || 'pcs',
                systemQty: qtyOf.get(`${p._id}:`) ?? 0,
            },
        ];
    });

    const countNumber = `SC-${Date.now()}`;
    const count = await StockCount.create({
        storeId: req.tenantId,
        countNumber,
        title: title?.trim() || undefined,
        notes,
        createdBy: req.user?._id,
        items: lines,
    });

    res.status(201).json(new ApiResponse(201, count, 'Stock count started'));
});

// @desc    List stock counts (without their lines)
// @route   GET /api/stock-counts
export const getStockCounts = asyncHandler(async (req: TenantRequest, res: Response) => {
    const counts = await StockCount.aggregate([
        { $match: { storeId: new mongoose.Types.ObjectId(String(req.tenantId)) } },
        { $sort: { createdAt: -1 } },
        { $limit: 100 },
        {
            $project: {
                countNumber: 1,
                title: 1,
                status: 1,
                createdAt: 1,
                completedAt: 1,
                totalItems: { $size: '$items' },
                countedItems: {
                    $size: {
                        $filter: { input: '$items', as: 'i', cond: { $ne: [{ $type: '$$i.countedQty' }, 'missing'] } },
                    },
                },
                varianceItems: {
                    $size: {
                        $filter: { input: '$items', as: 'i', cond: { $ne: [{ $ifNull: ['$$i.difference', 0] }, 0] } },
                    },
                },
            },
        },
    ]);
    res.status(200).json(new ApiResponse(200, counts));
});

// @desc    One stock count with all its lines
// @route   GET /api/stock-counts/:id
export const getStockCountById = asyncHandler(async (req: TenantRequest, res: Response) => {
    const count = await StockCount.findOne({ _id: req.params.id, storeId: req.tenantId }).lean();
    if (!count) return res.status(404).json(new ApiResponse(404, null, 'Stock count not found'));
    res.status(200).json(new ApiResponse(200, count));
});

// @desc    Save the quantities counted so far (a count can be saved and resumed)
// @route   PUT /api/stock-counts/:id
export const saveStockCount = asyncHandler(async (req: TenantRequest, res: Response) => {
    const count = await StockCount.findOne({ _id: req.params.id, storeId: req.tenantId });
    if (!count) return res.status(404).json(new ApiResponse(404, null, 'Stock count not found'));
    if (count.status === 'Completed') {
        return res.status(400).json(new ApiResponse(400, null, 'This stock count is already completed.'));
    }

    // counts: { [lineId]: number | null } — null clears a line back to "not counted".
    const counts: Record<string, number | null> = req.body.counts || {};
    for (const item of count.items as any[]) {
        const id = item._id.toString();
        if (!(id in counts)) continue;
        const value = counts[id];
        if (value === null || value === undefined) {
            item.countedQty = undefined;
        } else {
            const n = Number(value);
            if (!Number.isFinite(n) || n < 0) {
                return res.status(400).json(new ApiResponse(400, null, `Invalid quantity for ${item.name}`));
            }
            item.countedQty = n;
        }
    }
    if (typeof req.body.notes === 'string') count.notes = req.body.notes;
    await count.save();

    res.status(200).json(new ApiResponse(200, count, 'Stock count saved'));
});

// @desc    Finish the count — every counted line whose quantity differs is corrected in stock, with a ledger entry
// @route   POST /api/stock-counts/:id/complete
export const completeStockCount = asyncHandler(async (req: TenantRequest, res: Response) => {
    const count = await StockCount.findOne({ _id: req.params.id, storeId: req.tenantId });
    if (!count) return res.status(404).json(new ApiResponse(404, null, 'Stock count not found'));
    if (count.status === 'Completed') {
        return res.status(400).json(new ApiResponse(400, null, 'This stock count is already completed.'));
    }

    let adjusted = 0;
    for (const item of count.items as any[]) {
        if (item.countedQty === undefined || item.countedQty === null) {
            item.difference = undefined; // not counted → stock left untouched
            continue;
        }
        // Compare against the stock as it is NOW, so sales made during the count are not wiped out.
        const inv = await Inventory.findOne(inventoryFilter(req.tenantId, item));
        const current = inv?.quantity ?? 0;
        const delta = Math.round((item.countedQty - current) * 1000) / 1000;
        item.difference = Math.round((item.countedQty - item.systemQty) * 1000) / 1000;
        if (delta === 0) continue;

        await Inventory.findOneAndUpdate(
            inventoryFilter(req.tenantId, item),
            { $set: { quantity: item.countedQty, lastStockUpdate: new Date() } },
            { upsert: true }
        );
        await StockAdjustment.create({
            storeId: req.tenantId,
            productId: item.product,
            variantId: item.variant,
            previousQuantity: current,
            newQuantity: item.countedQty,
            adjustmentAmount: delta,
            type: delta > 0 ? 'ADD' : 'SUBTRACT',
            reason: 'Stock Count',
            notes: `Stock count ${count.countNumber}`,
            createdBy: req.user?._id,
        });
        await recordStockMovement({
            storeId: req.tenantId!,
            product: item.product,
            variant: item.variant,
            type: 'STOCK_COUNT',
            quantity: delta,
            reference: count.countNumber,
            referenceId: count._id as any,
            userId: req.user?._id,
        });
        adjusted++;
        emitToStore(req.tenantId!.toString(), 'inventory-update', {
            productId: item.product,
            variantId: item.variant,
            newQuantity: item.countedQty,
        });
    }

    count.status = 'Completed';
    count.completedAt = new Date();
    count.completedBy = req.user?._id;
    await count.save();
    await bumpCacheVersion(req.tenantId!.toString());

    await AuditLog.create({
        userId: req.user?._id,
        storeId: req.tenantId,
        action: 'STOCK_ADJUSTMENT',
        entity: 'Product',
        details: `Stock count ${count.countNumber} completed — ${adjusted} products corrected.`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
    });

    res.status(200).json(new ApiResponse(200, count, `Stock count completed — ${adjusted} products corrected`));
});

// @desc    Delete a stock count that has not been completed
// @route   DELETE /api/stock-counts/:id
export const deleteStockCount = asyncHandler(async (req: TenantRequest, res: Response) => {
    const count = await StockCount.findOne({ _id: req.params.id, storeId: req.tenantId });
    if (!count) return res.status(404).json(new ApiResponse(404, null, 'Stock count not found'));
    if (count.status === 'Completed') {
        return res.status(400).json(new ApiResponse(400, null, 'A completed stock count cannot be deleted.'));
    }
    await count.deleteOne();
    res.status(200).json(new ApiResponse(200, null, 'Stock count deleted'));
});
