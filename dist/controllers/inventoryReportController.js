import mongoose from 'mongoose';
import Inventory from '../models/Inventory.js';
import Order from '../models/Order.js';
import InventoryBatch from '../models/InventoryBatch.js';
import ApiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
const round2 = (n) => Math.round(n * 100) / 100;
const DAY = 24 * 60 * 60 * 1000;
// Sales per product over the last `days`, from the bills (cancelled bills do not count).
const salesByProduct = async (storeId, since) => {
    const rows = await Order.aggregate([
        { $match: { storeId, status: { $ne: 'Cancelled' }, ...(since ? { createdAt: { $gte: since } } : {}) } },
        { $unwind: '$items' },
        {
            $group: {
                _id: '$items.product',
                quantity: { $sum: '$items.quantity' },
                revenue: { $sum: '$items.total' },
                lastSold: { $max: '$createdAt' },
                bills: { $sum: 1 },
            },
        },
    ]);
    return new Map(rows.map((r) => [r._id.toString(), r]));
};
// Stock on hand with the product it belongs to (base products and variants both count).
const stockRows = async (storeId) => {
    const rows = await Inventory.aggregate([
        { $match: { store: storeId } },
        { $group: { _id: '$product', quantity: { $sum: '$quantity' } } },
        {
            $lookup: {
                from: 'products',
                localField: '_id',
                foreignField: '_id',
                as: 'product',
            },
        },
        { $unwind: '$product' },
        { $match: { 'product.isActive': { $ne: false }, 'product.isCombo': { $ne: true } } },
        {
            $lookup: {
                from: 'categories',
                localField: 'product.category',
                foreignField: '_id',
                as: 'category',
            },
        },
    ]);
    return rows.map((r) => ({
        productId: r._id,
        name: r.product.name,
        sku: r.product.sku,
        unit: r.product.unit,
        category: r.category?.[0]?.name || 'Uncategorized',
        quantity: r.quantity,
        costPrice: r.product.costPrice || 0,
        price: r.product.price || 0,
        createdAt: r.product.createdAt,
        lastPurchaseDate: r.product.lastPurchaseDate,
    }));
};
// @desc    Inventory reports: valuation, movers, dead stock, ABC, ageing, near-expiry
// @route   GET /api/inventory-reports/:type?days=
export const getInventoryReport = asyncHandler(async (req, res) => {
    const storeId = new mongoose.Types.ObjectId(String(req.tenantId));
    const type = req.params.type;
    const days = Math.min(Math.max(parseInt(req.query.days) || 0, 1), 730);
    if (type === 'valuation') {
        const stock = (await stockRows(storeId)).filter((r) => r.quantity > 0);
        const rows = stock
            .map((r) => ({
            ...r,
            costValue: round2(r.quantity * r.costPrice),
            retailValue: round2(r.quantity * r.price),
            marginPercent: r.price > 0 ? round2(((r.price - r.costPrice) / r.price) * 100) : 0,
        }))
            .sort((a, b) => b.costValue - a.costValue);
        const byCategory = new Map();
        for (const r of rows) {
            const c = byCategory.get(r.category) || { category: r.category, products: 0, costValue: 0, retailValue: 0 };
            c.products++;
            c.costValue = round2(c.costValue + r.costValue);
            c.retailValue = round2(c.retailValue + r.retailValue);
            byCategory.set(r.category, c);
        }
        return res.status(200).json(new ApiResponse(200, {
            rows,
            byCategory: [...byCategory.values()].sort((a, b) => b.costValue - a.costValue),
            totals: {
                costValue: round2(rows.reduce((s, r) => s + r.costValue, 0)),
                retailValue: round2(rows.reduce((s, r) => s + r.retailValue, 0)),
            },
        }));
    }
    if (type === 'profit') {
        // Profit = what was sold (before tax) minus what those units cost. Cost is each product's cost price
        // today, so it is as accurate as the cost prices you keep up to date.
        const period = days || 30;
        const sold = await Order.aggregate([
            {
                $match: {
                    storeId,
                    status: { $ne: 'Cancelled' },
                    createdAt: { $gte: new Date(Date.now() - period * DAY) },
                },
            },
            { $unwind: '$items' },
            {
                $group: {
                    _id: '$items.product',
                    quantity: { $sum: '$items.quantity' },
                    revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
                },
            },
            { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } },
            { $unwind: '$product' },
        ]);
        const rows = sold
            .map((r) => {
            const cost = round2((r.product.costPrice || 0) * r.quantity);
            const revenue = round2(r.revenue);
            const profit = round2(revenue - cost);
            return {
                productId: r._id,
                name: r.product.name,
                sku: r.product.sku,
                unit: r.product.unit,
                quantity: r.quantity,
                revenue,
                cost,
                profit,
                marginPercent: revenue > 0 ? round2((profit / revenue) * 100) : 0,
                noCost: !r.product.costPrice,
            };
        })
            .sort((a, b) => b.profit - a.profit);
        const revenue = round2(rows.reduce((s, r) => s + r.revenue, 0));
        const profit = round2(rows.reduce((s, r) => s + r.profit, 0));
        return res.status(200).json(new ApiResponse(200, {
            days: period,
            rows,
            totals: {
                revenue,
                cost: round2(revenue - profit),
                profit,
                marginPercent: revenue > 0 ? round2((profit / revenue) * 100) : 0,
                withoutCost: rows.filter((r) => r.noCost).length,
            },
        }));
    }
    if (type === 'movers') {
        const period = days || 30;
        const sales = await salesByProduct(storeId, new Date(Date.now() - period * DAY));
        const stock = await stockRows(storeId);
        const rows = stock
            .map((r) => {
            const s = sales.get(r.productId.toString());
            const sold = s?.quantity || 0;
            const perDay = sold / period;
            return {
                ...r,
                sold,
                revenue: round2(s?.revenue || 0),
                perDay: round2(perDay),
                daysOfStock: perDay > 0 ? Math.round(r.quantity / perDay) : null,
            };
        })
            .sort((a, b) => b.sold - a.sold);
        return res.status(200).json(new ApiResponse(200, { days: period, rows }));
    }
    if (type === 'dead-stock') {
        const period = days || 90;
        const [recent, ever] = await Promise.all([
            salesByProduct(storeId, new Date(Date.now() - period * DAY)),
            salesByProduct(storeId),
        ]);
        const rows = (await stockRows(storeId))
            .filter((r) => r.quantity > 0 && !recent.has(r.productId.toString()))
            .map((r) => {
            const last = ever.get(r.productId.toString())?.lastSold;
            return {
                ...r,
                lastSold: last || null,
                daysSinceSale: last ? Math.floor((Date.now() - new Date(last).getTime()) / DAY) : null,
                costValue: round2(r.quantity * r.costPrice),
            };
        })
            .sort((a, b) => b.costValue - a.costValue);
        return res.status(200).json(new ApiResponse(200, {
            days: period,
            rows,
            totals: { costValue: round2(rows.reduce((s, r) => s + r.costValue, 0)) },
        }));
    }
    if (type === 'abc') {
        const period = days || 90;
        const sales = await salesByProduct(storeId, new Date(Date.now() - period * DAY));
        const stock = new Map((await stockRows(storeId)).map((r) => [r.productId.toString(), r]));
        const sold = [...sales.entries()]
            .map(([id, s]) => ({ id, revenue: s.revenue, quantity: s.quantity }))
            .filter((s) => stock.has(s.id) && s.revenue > 0)
            .sort((a, b) => b.revenue - a.revenue);
        const total = sold.reduce((s, r) => s + r.revenue, 0);
        let running = 0;
        const rows = sold.map((s) => {
            running += s.revenue;
            const share = total > 0 ? (running / total) * 100 : 0;
            const before = total > 0 ? ((running - s.revenue) / total) * 100 : 0;
            // A product is A while the items before it have not yet reached 80% of sales, B up to 95%, then C.
            const abc = before < 80 ? 'A' : before < 95 ? 'B' : 'C';
            const p = stock.get(s.id);
            return {
                productId: s.id,
                name: p.name,
                sku: p.sku,
                category: p.category,
                quantity: s.quantity,
                revenue: round2(s.revenue),
                sharePercent: round2((s.revenue / total) * 100),
                cumulativePercent: round2(share),
                class: abc,
            };
        });
        const summary = ['A', 'B', 'C'].map((c) => ({
            class: c,
            products: rows.filter((r) => r.class === c).length,
            revenue: round2(rows.filter((r) => r.class === c).reduce((s, r) => s + r.revenue, 0)),
        }));
        return res.status(200).json(new ApiResponse(200, { days: period, rows, summary, totalRevenue: round2(total) }));
    }
    if (type === 'ageing') {
        // Age = days since the product was last bought (or first added, if never bought through a PO/bill).
        const buckets = [
            { label: '0-30 days', from: 0, to: 30, products: 0, costValue: 0 },
            { label: '31-60 days', from: 31, to: 60, products: 0, costValue: 0 },
            { label: '61-90 days', from: 61, to: 90, products: 0, costValue: 0 },
            { label: 'Over 90 days', from: 91, to: Infinity, products: 0, costValue: 0 },
        ];
        const rows = (await stockRows(storeId))
            .filter((r) => r.quantity > 0)
            .map((r) => {
            const since = new Date(r.lastPurchaseDate || r.createdAt).getTime();
            const age = Math.max(0, Math.floor((Date.now() - since) / DAY));
            const costValue = round2(r.quantity * r.costPrice);
            const bucket = buckets.find((b) => age >= b.from && age <= b.to);
            bucket.products++;
            bucket.costValue = round2(bucket.costValue + costValue);
            return { ...r, ageDays: age, bucket: bucket.label, costValue };
        })
            .sort((a, b) => b.ageDays - a.ageDays);
        return res.status(200).json(new ApiResponse(200, {
            rows,
            buckets: buckets.map((b) => ({ label: b.label, products: b.products, costValue: b.costValue })),
        }));
    }
    if (type === 'near-expiry') {
        const window = days || 60;
        const batches = await InventoryBatch.find({
            storeId,
            status: 'Active',
            currentQuantity: { $gt: 0 },
            expiryDate: { $lte: new Date(Date.now() + window * DAY) },
        })
            .populate('product', 'name sku unit costPrice')
            .populate('variant', 'name')
            .sort({ expiryDate: 1 })
            .limit(500)
            .lean();
        const now = Date.now();
        const rows = batches
            .filter((b) => b.product)
            .map((b) => {
            const daysLeft = Math.ceil((new Date(b.expiryDate).getTime() - now) / DAY);
            return {
                batchId: b._id,
                batchNumber: b.batchNumber,
                productId: b.product._id,
                name: b.variant?.name ? `${b.product.name} (${b.variant.name})` : b.product.name,
                sku: b.product.sku,
                unit: b.product.unit,
                quantity: b.currentQuantity,
                expiryDate: b.expiryDate,
                daysLeft,
                expired: daysLeft < 0,
                costValue: round2(b.currentQuantity * (b.costPrice || b.product.costPrice || 0)),
            };
        });
        return res.status(200).json(new ApiResponse(200, {
            days: window,
            rows,
            totals: {
                expiredValue: round2(rows.filter((r) => r.expired).reduce((s, r) => s + r.costValue, 0)),
                expiringValue: round2(rows.filter((r) => !r.expired).reduce((s, r) => s + r.costValue, 0)),
            },
        }));
    }
    res.status(400).json(new ApiResponse(400, null, 'Unknown report'));
});
