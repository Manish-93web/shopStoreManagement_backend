import { customAlphabet } from 'nanoid';
import Product from '../models/Product.js';
import ProductVariant from '../models/ProductVariant.js';
import Inventory from '../models/Inventory.js';
import Category from '../models/Category.js';
import AuditLog from '../models/AuditLog.js';
import AdjustmentRequest from '../models/AdjustmentRequest.js';
import ApiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { bumpCacheVersion } from '../config/redis.js';
import { emitToStore } from '../config/socket.js';
import { applyStockAdjustment } from '../utils/stockAdjust.js';
import { inventoryFilter, recordPriceChange, recordStockMovement, takeFromUnassigned } from '../utils/stockMovement.js';
import { notificationService } from '../services/notificationService.js';
import Settings from '../models/Settings.js';
const round2 = (n) => Math.round(n * 100) / 100;
// ── Bulk price update ──
// @desc    Change the price / MRP / cost of many products at once (by category, brand or a list)
//          Body: { field, mode: 'percent' | 'amount' | 'set', value, categoryId?, brandId?, productIds?,
//                  all?, preview? } — with preview:true nothing is saved, the result shows what would change.
// @route   POST /api/stock-admin/bulk-price
export const bulkPriceUpdate = asyncHandler(async (req, res) => {
    const { field, mode, categoryId, brandId, productIds, all, preview } = req.body;
    const value = Number(req.body.value);
    if (!['price', 'mrp', 'costPrice'].includes(field)) {
        return res.status(400).json(new ApiResponse(400, null, 'Choose which price to change.'));
    }
    if (!['percent', 'amount', 'set'].includes(mode) || !Number.isFinite(value)) {
        return res.status(400).json(new ApiResponse(400, null, 'Enter how to change the price.'));
    }
    if (mode === 'set' && value < 0) {
        return res.status(400).json(new ApiResponse(400, null, 'A price cannot be negative.'));
    }
    if (req.user?.role === 'MANAGER') {
        const cfg = await Settings.findOne({ storeId: req.tenantId }).select('inventoryConfig');
        if (cfg?.inventoryConfig?.managersCanChangePrice === false) {
            return res.status(403).json(new ApiResponse(403, null, 'Only the owner can change prices.'));
        }
    }
    const query = { storeId: req.tenantId, isActive: { $ne: false } };
    const hasScope = (categoryId && categoryId !== 'All') || (brandId && brandId !== 'All') || productIds?.length;
    if (!hasScope && !all) {
        return res
            .status(400)
            .json(new ApiResponse(400, null, 'Choose a category, a brand, some products, or "all products".'));
    }
    if (categoryId && categoryId !== 'All') {
        const children = await Category.find({ parentId: categoryId, storeId: req.tenantId }).select('_id');
        query.category = { $in: [categoryId, ...children.map((c) => c._id)] };
    }
    if (brandId && brandId !== 'All')
        query.brand = brandId;
    if (Array.isArray(productIds) && productIds.length)
        query._id = { $in: productIds };
    const products = await Product.find(query).select(`name ${field}`).lean();
    const changes = products
        .map((p) => {
        const old = Number(p[field]) || 0;
        let next = mode === 'percent' ? old * (1 + value / 100) : mode === 'amount' ? old + value : value;
        next = Math.max(0, round2(next));
        return { _id: p._id, name: p.name, oldValue: old, newValue: next };
    })
        .filter((c) => c.oldValue !== c.newValue);
    if (preview) {
        return res
            .status(200)
            .json(new ApiResponse(200, { count: changes.length, total: products.length, sample: changes.slice(0, 50) }));
    }
    for (const c of changes) {
        await Product.updateOne({ _id: c._id, storeId: req.tenantId }, { $set: { [field]: c.newValue } });
        await recordPriceChange({
            storeId: req.tenantId,
            product: c._id,
            field,
            oldValue: c.oldValue,
            newValue: c.newValue,
            source: 'Bulk update',
            note: mode === 'percent'
                ? `${value > 0 ? '+' : ''}${value}%`
                : mode === 'amount'
                    ? `${value > 0 ? '+' : ''}${value}`
                    : `Set to ${value}`,
            userId: req.user?._id,
        });
    }
    if (changes.length > 0) {
        await bumpCacheVersion(req.tenantId.toString());
        await AuditLog.create({
            userId: req.user?._id,
            storeId: req.tenantId,
            action: 'PRICE_CHANGE',
            entity: 'Product',
            details: `Bulk price update: ${changes.length} products' ${field} changed (${mode} ${value}).`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
        });
    }
    res.status(200).json(new ApiResponse(200, { count: changes.length }, `${changes.length} prices updated`));
});
// ── Pack conversion ──
// @desc    Open a box into pieces (or the reverse): takes stock from one product and adds it to another
//          Body: { fromProduct, toProduct, quantity, ratio } — ratio = how many "to" units one "from" unit gives.
// @route   POST /api/stock-admin/convert
export const convertStock = asyncHandler(async (req, res) => {
    const { fromProduct, toProduct } = req.body;
    const quantity = Number(req.body.quantity);
    const ratio = Number(req.body.ratio);
    if (!fromProduct || !toProduct || fromProduct === toProduct) {
        return res.status(400).json(new ApiResponse(400, null, 'Choose two different products.'));
    }
    if (!(quantity > 0) || !(ratio > 0)) {
        return res
            .status(400)
            .json(new ApiResponse(400, null, 'Enter the quantity and how many units each one gives.'));
    }
    const [from, to] = await Promise.all([
        Product.findOne({ _id: fromProduct, storeId: req.tenantId, isCombo: { $ne: true } }).select('name'),
        Product.findOne({ _id: toProduct, storeId: req.tenantId, isCombo: { $ne: true } }).select('name'),
    ]);
    if (!from || !to)
        return res.status(404).json(new ApiResponse(404, null, 'Product not found'));
    const fromInv = await Inventory.findOne(inventoryFilter(req.tenantId, from._id));
    if ((fromInv?.quantity ?? 0) < quantity) {
        return res
            .status(400)
            .json(new ApiResponse(400, null, `Only ${fromInv?.quantity ?? 0} of "${from.name}" in stock.`));
    }
    const gained = Math.round(quantity * ratio * 1000) / 1000;
    await Inventory.findOneAndUpdate(inventoryFilter(req.tenantId, from._id), {
        $inc: { quantity: -quantity },
        $set: { lastStockUpdate: new Date() },
    });
    await Inventory.findOneAndUpdate(inventoryFilter(req.tenantId, to._id), { $inc: { quantity: gained }, $set: { lastStockUpdate: new Date() } }, { upsert: true });
    const reference = `Converted ${quantity} x ${from.name} into ${gained} x ${to.name}`;
    await recordStockMovement({
        storeId: req.tenantId,
        product: from._id,
        type: 'CONVERT_OUT',
        quantity: -quantity,
        reference,
        userId: req.user?._id,
    });
    await recordStockMovement({
        storeId: req.tenantId,
        product: to._id,
        type: 'CONVERT_IN',
        quantity: gained,
        reference,
        userId: req.user?._id,
    });
    await bumpCacheVersion(req.tenantId.toString());
    for (const id of [from._id, to._id]) {
        const inv = await Inventory.findOne(inventoryFilter(req.tenantId, id));
        emitToStore(req.tenantId.toString(), 'inventory-update', { productId: id, newQuantity: inv?.quantity });
    }
    res.status(200).json(new ApiResponse(200, { gained }, reference));
});
// ── Size / colour grid ──
// @desc    Create every size x colour variant of a product in one go
//          Body: { sizes: string[], colors: string[], price?, costPrice?, initialStock? }
// @route   POST /api/stock-admin/variants/:productId/generate
export const generateVariants = asyncHandler(async (req, res) => {
    const clean = (list) => Array.isArray(list) ? [...new Set(list.map((v) => String(v).trim()).filter(Boolean))] : [];
    const sizes = clean(req.body.sizes);
    const colors = clean(req.body.colors);
    if (sizes.length === 0 && colors.length === 0) {
        return res.status(400).json(new ApiResponse(400, null, 'Enter at least one size or colour.'));
    }
    if ((sizes.length || 1) * (colors.length || 1) > 200) {
        return res
            .status(400)
            .json(new ApiResponse(400, null, 'That is more than 200 variants. Use fewer sizes or colours.'));
    }
    const product = await Product.findOne({ _id: req.params.productId, storeId: req.tenantId }).select('sku price costPrice');
    if (!product)
        return res.status(404).json(new ApiResponse(404, null, 'Product not found'));
    const existing = await ProductVariant.find({ productId: product._id, storeId: req.tenantId }).select('name');
    const taken = new Set(existing.map((v) => v.name.toLowerCase()));
    const code = (s) => s.toUpperCase().replace(/[^A-Z0-9]+/g, '');
    const makeBarcode = customAlphabet('0123456789', 12);
    const initialStock = Number(req.body.initialStock) || 0;
    const price = req.body.price !== undefined && req.body.price !== '' ? Number(req.body.price) : undefined;
    const costPrice = req.body.costPrice !== undefined && req.body.costPrice !== '' ? Number(req.body.costPrice) : undefined;
    let created = 0;
    let skipped = 0;
    for (const size of sizes.length ? sizes : [undefined]) {
        for (const color of colors.length ? colors : [undefined]) {
            const parts = [size, color].filter(Boolean);
            const name = parts.join(' / ');
            if (taken.has(name.toLowerCase())) {
                skipped++;
                continue;
            }
            const attributes = {};
            if (size)
                attributes.size = size;
            if (color)
                attributes.color = color;
            const variant = await ProductVariant.create({
                productId: product._id,
                storeId: req.tenantId,
                name,
                sku: `${product.sku}-${parts.map(code).join('-')}`,
                barcode: makeBarcode(),
                price,
                costPrice,
                attributes,
            });
            await Inventory.create({
                product: product._id,
                variant: variant._id,
                store: req.tenantId,
                quantity: initialStock,
            });
            if (initialStock > 0) {
                await takeFromUnassigned(req.tenantId, product._id, initialStock, req.user?._id);
                await recordStockMovement({
                    storeId: req.tenantId,
                    product: product._id,
                    variant: variant._id,
                    type: 'OPENING',
                    quantity: initialStock,
                    reference: 'Opening stock',
                    userId: req.user?._id,
                });
            }
            created++;
        }
    }
    if (created > 0) {
        await Product.findByIdAndUpdate(product._id, { hasVariants: true });
        await bumpCacheVersion(req.tenantId.toString());
    }
    res.status(201).json(new ApiResponse(201, { created, skipped }, `${created} variants created${skipped ? `, ${skipped} already existed` : ''}`));
});
// ── Adjustments waiting for approval ──
// @desc    Stock adjustments that need the owner's decision
// @route   GET /api/stock-admin/adjustment-requests
export const getAdjustmentRequests = asyncHandler(async (req, res) => {
    const status = req.query.status || 'Pending';
    const requests = await AdjustmentRequest.find({ storeId: req.tenantId, status })
        .populate('product', 'name sku unit')
        .populate('requestedBy', 'name')
        .populate('decidedBy', 'name')
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();
    res.status(200).json(new ApiResponse(200, requests));
});
// @desc    Approve (applies the adjustment) or reject a request
// @route   PUT /api/stock-admin/adjustment-requests/:id/:decision
export const decideAdjustmentRequest = asyncHandler(async (req, res) => {
    const decision = req.params.decision;
    if (decision !== 'approve' && decision !== 'reject') {
        return res.status(400).json(new ApiResponse(400, null, 'Decision must be approve or reject'));
    }
    const request = await AdjustmentRequest.findOne({ _id: req.params.id, storeId: req.tenantId });
    if (!request)
        return res.status(404).json(new ApiResponse(404, null, 'Request not found'));
    if (request.status !== 'Pending') {
        return res
            .status(400)
            .json(new ApiResponse(400, null, `This request was already ${request.status.toLowerCase()}.`));
    }
    if (decision === 'approve') {
        await applyStockAdjustment({
            tenantId: req.tenantId,
            productId: request.product.toString(),
            quantity: request.quantity,
            reason: request.reason,
            notes: `${request.notes ? request.notes + ' · ' : ''}Approved by ${req.user?.name || 'owner'}`,
            userId: request.requestedBy,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
        });
    }
    request.status = decision === 'approve' ? 'Approved' : 'Rejected';
    request.decidedBy = req.user?._id;
    request.decidedAt = new Date();
    await request.save();
    await notificationService.send({
        recipientId: request.requestedBy.toString(),
        storeId: req.tenantId.toString(),
        title: `Stock adjustment ${request.status.toLowerCase()}`,
        message: `Your request to ${request.quantity > 0 ? 'add' : 'remove'} ${Math.abs(request.quantity)} units was ${request.status.toLowerCase()}.`,
        type: decision === 'approve' ? 'SUCCESS' : 'WARNING',
    });
    res.status(200).json(new ApiResponse(200, request, `Request ${request.status.toLowerCase()}`));
});
