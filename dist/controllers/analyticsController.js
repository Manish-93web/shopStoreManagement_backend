import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Inventory from '../models/Inventory.js';
import Customer from '../models/Customer.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import SupplierPayment from '../models/SupplierPayment.js';
import Supplier from '../models/Supplier.js';
import ApiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import dayjs from 'dayjs';
import { withCache } from '../config/redis.js';
// @desc    Get Sales Prediction (AI Placeholder)
// @route   GET /api/v1/analytics/prediction
export const getSalesPrediction = asyncHandler(async (req, res) => {
    const storeId = req.tenantId;
    const thirtyDaysAgo = dayjs().subtract(30, 'day').toDate();
    const orders = await Order.find({
        storeId,
        createdAt: { $gte: thirtyDaysAgo },
        status: 'Completed',
    });
    const totalRevenue = orders.reduce((sum, order) => sum + order.grandTotal, 0);
    const dailyAverage = totalRevenue / 30;
    const prediction = [];
    for (let i = 1; i <= 7; i++) {
        const date = dayjs().add(i, 'day').format('YYYY-MM-DD');
        const variance = Math.random() * 0.2 - 0.1;
        const predictedRevenue = dailyAverage * (1 + variance);
        prediction.push({
            date,
            predictedRevenue: Math.round(predictedRevenue),
            confidence: 0.85,
        });
    }
    res.status(200).json(new ApiResponse(200, {
        dailyAverage: Math.round(dailyAverage),
        totalLast30Days: totalRevenue,
        prediction,
    }, 'Sales prediction generated successfully'));
});
// @desc    Get Sales by Category
// @route   GET /api/v1/analytics/categories
export const getCategoryAnalytics = asyncHandler(async (req, res) => {
    const storeId = req.tenantId;
    const { value: result } = await withCache(`analytics:categories:${storeId}`, 300, async () => {
        const orders = await Order.find({ storeId, status: 'Completed' }).populate({
            path: 'items.product',
            populate: { path: 'category' },
        });
        const categorySales = {};
        orders.forEach((order) => {
            order.items.forEach((item) => {
                const product = item.product;
                if (product) {
                    const catName = product.category && typeof product.category === 'object'
                        ? product.category.name || 'Uncategorized'
                        : product.category || 'Uncategorized';
                    const revenue = item.price * item.quantity;
                    categorySales[catName] = (categorySales[catName] || 0) + revenue;
                }
            });
        });
        return Object.keys(categorySales)
            .map((name) => ({
            name,
            value: categorySales[name],
        }))
            .sort((a, b) => b.value - a.value);
    });
    res.status(200).json(new ApiResponse(200, result, 'Category analytics generated'));
});
// @desc    Get Dashboard Summary
// @route   GET /api/v1/analytics/summary
export const getDashboardSummary = asyncHandler(async (req, res) => {
    const storeId = req.tenantId;
    const { value: summary } = await withCache(`analytics:summary:${storeId}`, 60, async () => {
        const today = dayjs().startOf('day').toDate();
        const yesterday = dayjs().subtract(1, 'day').startOf('day').toDate();
        const [todayOrders, yesterdayOrders, totalProducts, lowStockCount] = await Promise.all([
            Order.find({ storeId, createdAt: { $gte: today }, status: 'Completed' }),
            Order.find({ storeId, createdAt: { $gte: yesterday, $lt: today }, status: 'Completed' }),
            Product.countDocuments({ storeId }),
            Inventory.countDocuments({ store: storeId, quantity: { $lte: 10 } }),
        ]);
        const todayRevenue = todayOrders.reduce((sum, o) => sum + o.grandTotal, 0);
        const yesterdayRevenue = yesterdayOrders.reduce((sum, o) => sum + o.grandTotal, 0);
        const revenueGrowth = yesterdayRevenue > 0 ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100 : 0;
        return {
            today: {
                revenue: todayRevenue,
                orders: todayOrders.length,
            },
            revenueGrowth: Math.round(revenueGrowth),
            totalProducts,
            lowStockCount,
        };
    });
    res.status(200).json(new ApiResponse(200, summary));
});
// @desc    Get Customer Retention Stats
// @route   GET /api/v1/analytics/retention
export const getRetentionStats = asyncHandler(async (req, res) => {
    const storeId = req.tenantId;
    const customers = await Customer.find({ storeId });
    const orders = await Order.find({ storeId, status: 'Completed' });
    const orderCounts = {};
    orders.forEach((order) => {
        if (order.customer) {
            const cid = order.customer.toString();
            orderCounts[cid] = (orderCounts[cid] || 0) + 1;
        }
    });
    const stats = {
        totalCustomers: customers.length,
        repeatCustomers: Object.values(orderCounts).filter((count) => count > 1).length,
        oneTimeCustomers: Object.values(orderCounts).filter((count) => count === 1).length,
        retentionRate: customers.length > 0
            ? (Object.values(orderCounts).filter((count) => count > 1).length / customers.length) * 100
            : 0,
    };
    res.status(200).json(new ApiResponse(200, stats));
});
// @desc    Get Supplier Performance Analytics
// @route   GET /api/v1/analytics/suppliers
export const getSupplierAnalytics = asyncHandler(async (req, res) => {
    const storeId = req.tenantId;
    const [pos, payments, suppliers] = await Promise.all([
        PurchaseOrder.find({ storeId }),
        SupplierPayment.find({ storeId }),
        Supplier.find({ storeId }),
    ]);
    const stats = suppliers.map((supplier) => {
        const supplierPOs = pos.filter((po) => po.supplier.toString() === supplier._id.toString());
        const supplierPayments = payments.filter((p) => p.supplierId.toString() === supplier._id.toString());
        const totalOrdered = supplierPOs.reduce((sum, po) => sum + po.grandTotal, 0);
        const totalPaid = supplierPayments.reduce((sum, p) => sum + p.amount, 0);
        const pendingAmount = totalOrdered - totalPaid;
        // Real performance signals, not just spend: fulfillment rate (how much of what
        // was ordered actually arrived) and average lead time (days from order to
        // receipt), computed from PurchaseOrder's own quantity/timestamp fields —
        // no fabricated "on-time %" that would need an expected-delivery-date field
        // this schema doesn't have.
        const fulfillablePOs = supplierPOs.filter((po) => po.status !== 'Draft' && po.status !== 'Cancelled');
        let orderedQty = 0;
        let receivedQty = 0;
        for (const po of fulfillablePOs) {
            for (const item of po.items) {
                orderedQty += item.quantity;
                receivedQty += item.receivedQuantity || 0;
            }
        }
        const fulfillmentRate = orderedQty > 0 ? Math.min(100, (receivedQty / orderedQty) * 100) : null;
        const receivedPOs = supplierPOs.filter((po) => po.status === 'Received' && po.receivedAt);
        const avgLeadTimeDays = receivedPOs.length > 0
            ? receivedPOs.reduce((sum, po) => {
                const days = (po.receivedAt.getTime() - po.createdAt.getTime()) / (1000 * 60 * 60 * 24);
                return sum + days;
            }, 0) / receivedPOs.length
            : null;
        return {
            supplierId: supplier._id,
            name: supplier.name,
            poCount: supplierPOs.length,
            totalOrdered,
            totalPaid,
            pendingAmount: pendingAmount > 0 ? pendingAmount : 0,
            fulfillmentRate: fulfillmentRate !== null ? Math.round(fulfillmentRate * 10) / 10 : null,
            avgLeadTimeDays: avgLeadTimeDays !== null ? Math.round(avgLeadTimeDays * 10) / 10 : null,
        };
    });
    res.status(200).json(new ApiResponse(200, stats, 'Supplier analytics generated'));
});
// @desc    Get Category Growth (Month-over-Month)
// @route   GET /api/v1/analytics/category-growth
export const getCategoryGrowth = asyncHandler(async (req, res) => {
    const storeId = req.tenantId;
    const { value: growth } = await withCache(`analytics:category-growth:${storeId}`, 600, async () => {
        const now = dayjs();
        const currentMonthStart = now.startOf('month').toDate();
        const lastMonthStart = now.subtract(1, 'month').startOf('month').toDate();
        const productPopulate = { path: 'items.product', populate: { path: 'category' } };
        const [currentOrders, lastOrders] = await Promise.all([
            Order.find({ storeId, createdAt: { $gte: currentMonthStart }, status: 'Completed' }).populate(productPopulate),
            Order.find({
                storeId,
                createdAt: { $gte: lastMonthStart, $lt: currentMonthStart },
                status: 'Completed',
            }).populate(productPopulate),
        ]);
        const calculateCatSales = (orders) => {
            const sales = {};
            orders.forEach((o) => o.items.forEach((i) => {
                if (i.product) {
                    const cat = i.product.category && typeof i.product.category === 'object'
                        ? i.product.category.name || 'Uncategorized'
                        : i.product.category || 'Uncategorized';
                    sales[cat] = (sales[cat] || 0) + i.total;
                }
            }));
            return sales;
        };
        const currentSales = calculateCatSales(currentOrders);
        const lastSales = calculateCatSales(lastOrders);
        return Object.keys(currentSales)
            .map((cat) => {
            const current = currentSales[cat] || 0;
            const last = lastSales[cat] || 0;
            const change = last > 0 ? ((current - last) / last) * 100 : 100;
            return { name: cat, growth: Math.round(change), current, last };
        })
            .sort((a, b) => b.growth - a.growth);
    });
    res.status(200).json(new ApiResponse(200, growth));
});
// @desc    Get Retention Trends (Last 6 Months)
// @route   GET /api/v1/analytics/retention-trends
export const getRetentionTrends = asyncHandler(async (req, res) => {
    const storeId = req.tenantId;
    const trends = [];
    for (let i = 5; i >= 0; i--) {
        const monthStart = dayjs().subtract(i, 'month').startOf('month').toDate();
        const monthEnd = dayjs().subtract(i, 'month').endOf('month').toDate();
        const orders = await Order.find({
            storeId,
            createdAt: { $gte: monthStart, $lte: monthEnd },
            status: 'Completed',
        });
        const customerOrderCounts = {};
        orders.forEach((o) => {
            if (o.customer) {
                const cid = o.customer.toString();
                customerOrderCounts[cid] = (customerOrderCounts[cid] || 0) + 1;
            }
        });
        const repeat = Object.values(customerOrderCounts).filter((c) => c > 1).length;
        const total = Object.keys(customerOrderCounts).length;
        trends.push({
            month: dayjs(monthStart).format('MMM'),
            newCustomers: total - repeat,
            returningCustomers: repeat,
            total,
        });
    }
    res.status(200).json(new ApiResponse(200, trends));
});
