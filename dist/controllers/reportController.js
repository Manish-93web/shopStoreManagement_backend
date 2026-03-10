import Order from '../models/Order.js';
import Inventory from '../models/Inventory.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/apiResponse.js';
import { addReportJob } from '../queues/reportQueue.js';
import ExcelJS from 'exceljs';
// @desc    Get sales analytics for store
// @route   GET /api/reports/sales
export const getSalesReport = asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;
    const query = { storeId: req.tenantId };
    if (startDate && endDate) {
        query.createdAt = {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
        };
    }
    const orders = await Order.find(query);
    const stats = {
        totalRevenue: orders.reduce((acc, o) => acc + o.grandTotal, 0),
        totalOrders: orders.length,
        totalItemsSold: orders.reduce((acc, o) => acc + o.items.reduce((sum, i) => sum + i.quantity, 0), 0),
        averageOrderValue: orders.length > 0 ? orders.reduce((acc, o) => acc + o.grandTotal, 0) / orders.length : 0
    };
    res.status(200).json(new ApiResponse(200, stats));
});
// @desc    Get profit and loss report
// @route   GET /api/reports/profit
export const getProfitReport = asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;
    const query = { storeId: req.tenantId };
    if (startDate && endDate) {
        query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    const orders = await Order.find(query).populate('items.product');
    let totalRevenue = 0;
    let totalCost = 0;
    orders.forEach(order => {
        totalRevenue += order.grandTotal;
        order.items.forEach((item) => {
            const costPrice = item.product?.costPrice || 0;
            totalCost += (costPrice * item.quantity);
        });
    });
    res.status(200).json(new ApiResponse(200, {
        totalRevenue,
        totalCost,
        grossProfit: totalRevenue - totalCost,
        profitMargin: totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0
    }));
});
// @desc    Get tax report
// @route   GET /api/reports/tax
export const getTaxReport = asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;
    const query = { storeId: req.tenantId };
    if (startDate && endDate) {
        query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    const orders = await Order.find(query);
    const taxSummary = orders.reduce((acc, order) => {
        acc.totalTax += order.taxTotal;
        acc.taxableAmount += (order.grandTotal - order.taxTotal);
        return acc;
    }, { totalTax: 0, taxableAmount: 0 });
    res.status(200).json(new ApiResponse(200, taxSummary));
});
// @desc    Get low stock alert report
// @route   GET /api/reports/low-stock
export const getLowStockReport = asyncHandler(async (req, res) => {
    const threshold = parseInt(req.query.threshold) || 10;
    const lowStock = await Inventory.find({
        store: req.tenantId,
        quantity: { $lte: threshold }
    }).populate('product', 'name sku price');
    res.status(200).json(new ApiResponse(200, lowStock));
});
// @desc    Queue background report generation
// @route   POST /api/reports/queue
export const queueReport = asyncHandler(async (req, res) => {
    const { type, filters } = req.body;
    await addReportJob({
        tenantId: req.tenantId,
        type,
        filters
    });
    res.status(202).json(new ApiResponse(202, null, "Report generation job started in background"));
});
// @desc    Export report as Excel
// @route   GET /api/reports/export
export const exportReport = asyncHandler(async (req, res) => {
    const { type, startDate, endDate } = req.query;
    const query = { storeId: req.tenantId };
    if (startDate && endDate) {
        query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Report');
    if (type === 'sales') {
        const orders = await Order.find(query);
        worksheet.columns = [
            { header: 'Order ID', key: '_id', width: 30 },
            { header: 'Customer', key: 'customer', width: 20 },
            { header: 'Total', key: 'grandTotal', width: 15 },
            { header: 'Date', key: 'createdAt', width: 20 }
        ];
        orders.forEach(order => worksheet.addRow(order));
    }
    else if (type === 'inventory') {
        const items = await Inventory.find({ store: req.tenantId }).populate('product');
        worksheet.columns = [
            { header: 'Product', key: 'productName', width: 30 },
            { header: 'SKU', key: 'sku', width: 15 },
            { header: 'Stock', key: 'quantity', width: 15 }
        ];
        items.forEach((item) => {
            worksheet.addRow({
                productName: item.product?.name,
                sku: item.product?.sku,
                quantity: item.quantity
            });
        });
    }
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=report-${type}-${Date.now()}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
});
