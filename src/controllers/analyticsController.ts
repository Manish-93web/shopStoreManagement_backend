import { Response } from 'express';
import { TenantRequest } from '../middleware/tenantHandler.js';
import Order from '../models/Order.js';
import ApiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import dayjs from 'dayjs';

// @desc    Get Sales Prediction (AI Placeholder)
// @route   GET /api/v1/analytics/prediction
export const getSalesPrediction = asyncHandler(async (req: TenantRequest, res: Response) => {
    const storeId = req.tenantId;

    // Fetch last 30 days of orders
    const thirtyDaysAgo = dayjs().subtract(30, 'day').toDate();
    const orders = await Order.find({
        storeId,
        createdAt: { $gte: thirtyDaysAgo },
        status: 'Completed'
    });

    const totalRevenue = orders.reduce((sum, order) => sum + order.grandTotal, 0);
    const dailyAverage = totalRevenue / 30;

    // Generate 7-day prediction
    const prediction = [];
    for (let i = 1; i <= 7; i++) {
        const date = dayjs().add(i, 'day').format('YYYY-MM-DD');
        // Add some "AI" randomness (+/- 10%)
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
export const getCategoryAnalytics = asyncHandler(async (req: TenantRequest, res: Response) => {
    const storeId = req.tenantId;

    const orders = await Order.find({ storeId, status: 'Completed' })
        .populate('items.product');

    // Group sales by category
    const categorySales: Record<string, number> = {};

    orders.forEach(order => {
        order.items.forEach((item: any) => {
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
