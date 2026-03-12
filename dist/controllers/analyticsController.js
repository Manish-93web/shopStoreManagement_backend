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
// @desc    Get Sales Prediction (AI Placeholder)
// @route   GET /api/v1/analytics/prediction
export const getSalesPrediction = asyncHandler(async (req, res) => {
    const storeId = req.tenantId;
    const thirtyDaysAgo = dayjs().subtract(30, 'day').toDate();
    const orders = await Order.find({
        storeId,
        createdAt: { $gte: thirtyDaysAgo },
        status: 'Completed'
    });
    const totalRevenue = orders.reduce((sum, order) => sum + order.grandTotal, 0);
    const dailyAverage = totalRevenue / 30;
    const prediction = [];
    for (let i = 1; i <= 7; i++) {
        const date = dayjs().add(i, 'day').format('YYYY-MM-DD');
        const variance = (Math.random() * 0.2) - 0.1;
        const predictedRevenue = dailyAverage * (1 + variance);
        prediction.push({
            date,
            predictedRevenue: Math.round(predictedRevenue),
            confidence: 0.85
        });
    }
    res.status(200).json(new ApiResponse(200, {
        dailyAverage: Math.round(dailyAverage),
        totalLast30Days: totalRevenue,
        prediction
    }, "Sales prediction generated successfully"));
});
// @desc    Get Sales by Category
// @route   GET /api/v1/analytics/categories
export const getCategoryAnalytics = asyncHandler(async (req, res) => {
    const storeId = req.tenantId;
    const orders = await Order.find({ storeId, status: 'Completed' })
        .populate('items.product');
    const categorySales = {};
    orders.forEach(order => {
        order.items.forEach((item) => {
            const product = item.product;
            if (product) {
                const catName = typeof product.category === 'object' ? product.category.name : (product.category || 'Uncategorized');
                const revenue = item.price * item.quantity;
                categorySales[catName] = (categorySales[catName] || 0) + revenue;
            }
        });
    });
    const result = Object.keys(categorySales).map(name => ({
        name,
        value: categorySales[name]
    })).sort((a, b) => b.value - a.value);
    res.status(200).json(new ApiResponse(200, result, "Category analytics generated"));
});
// @desc    Get Dashboard Summary
// @route   GET /api/v1/analytics/summary
export const getDashboardSummary = asyncHandler(async (req, res) => {
    const storeId = req.tenantId;
    const today = dayjs().startOf('day').toDate();
    const yesterday = dayjs().subtract(1, 'day').startOf('day').toDate();
    const [todayOrders, yesterdayOrders, totalProducts, lowStockCount] = await Promise.all([
        Order.find({ storeId, createdAt: { $gte: today }, status: 'Completed' }),
        Order.find({ storeId, createdAt: { $gte: yesterday, $lt: today }, status: 'Completed' }),
        Product.countDocuments({ storeId }),
        Inventory.countDocuments({ store: storeId, quantity: { $lte: 10 } })
    ]);
    const todayRevenue = todayOrders.reduce((sum, o) => sum + o.grandTotal, 0);
    const yesterdayRevenue = yesterdayOrders.reduce((sum, o) => sum + o.grandTotal, 0);
    const revenueGrowth = yesterdayRevenue > 0
        ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100
        : 0;
    res.status(200).json(new ApiResponse(200, {
        today: {
            revenue: todayRevenue,
            orders: todayOrders.length,
        },
        revenueGrowth: Math.round(revenueGrowth),
        totalProducts,
        lowStockCount
    }));
});
// @desc    Get Customer Retention Stats
// @route   GET /api/v1/analytics/retention
export const getRetentionStats = asyncHandler(async (req, res) => {
    const storeId = req.tenantId;
    const customers = await Customer.find({ storeId });
    const orders = await Order.find({ storeId, status: 'Completed' });
    const orderCounts = {};
    orders.forEach(order => {
        if (order.customer) {
            const cid = order.customer.toString();
            orderCounts[cid] = (orderCounts[cid] || 0) + 1;
        }
    });
    const stats = {
        totalCustomers: customers.length,
        repeatCustomers: Object.values(orderCounts).filter(count => count > 1).length,
        oneTimeCustomers: Object.values(orderCounts).filter(count => count === 1).length,
        retentionRate: customers.length > 0
            ? (Object.values(orderCounts).filter(count => count > 1).length / customers.length) * 100
            : 0
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
        Supplier.find({ storeId })
    ]);
    const stats = suppliers.map(supplier => {
        const supplierPOs = pos.filter(po => po.supplier.toString() === supplier._id.toString());
        const supplierPayments = payments.filter(p => p.supplierId.toString() === supplier._id.toString());
        const totalOrdered = supplierPOs.reduce((sum, po) => sum + po.grandTotal, 0);
        const totalPaid = supplierPayments.reduce((sum, p) => sum + p.amount, 0);
        const pendingAmount = totalOrdered - totalPaid;
        return {
            supplierId: supplier._id,
            name: supplier.name,
            poCount: supplierPOs.length,
            totalOrdered,
            totalPaid,
            pendingAmount: pendingAmount > 0 ? pendingAmount : 0
        };
    });
    res.status(200).json(new ApiResponse(200, stats, "Supplier analytics generated"));
});
