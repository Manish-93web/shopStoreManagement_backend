import Order from '../models/Order.js';
import Inventory from '../models/Inventory.js';
import Customer from '../models/Customer.js';
import AuditLog from '../models/AuditLog.js';
import StockAdjustment from '../models/StockAdjustment.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import Shift from '../models/Shift.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/apiResponse.js';
import { addReportJob } from '../queues/reportQueue.js';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { withCache } from '../config/redis.js';
// @desc    Get sales analytics for store
// @route   GET /api/reports/sales
export const getSalesReport = asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;
    const cacheKey = `analytics:sales-report:${req.tenantId}:${startDate || ''}:${endDate || ''}`;
    const { value: stats } = await withCache(cacheKey, 120, async () => {
        const query = { storeId: req.tenantId, status: 'Completed' };
        if (startDate && endDate) {
            query.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate),
            };
        }
        const orders = await Order.find(query);
        return {
            totalRevenue: orders.reduce((acc, o) => acc + o.grandTotal, 0),
            totalOrders: orders.length,
            totalItemsSold: orders.reduce((acc, o) => acc + o.items.reduce((sum, i) => sum + i.quantity, 0), 0),
            averageOrderValue: orders.length > 0 ? orders.reduce((acc, o) => acc + o.grandTotal, 0) / orders.length : 0,
            taxTotal: orders.reduce((acc, o) => acc + (o.taxTotal || 0), 0),
            discountTotal: orders.reduce((acc, o) => acc + (o.discountTotal || 0), 0),
        };
    });
    res.status(200).json(new ApiResponse(200, stats));
});
// @desc    Get profit and loss report
// @route   GET /api/reports/profit
export const getProfitReport = asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;
    const query = { storeId: req.tenantId, status: 'Completed' };
    if (startDate && endDate) {
        query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    const orders = await Order.find(query).populate('items.product');
    const dailyProfit = {};
    orders.forEach((order) => {
        const dateKey = new Date(order.createdAt).toISOString().split('T')[0];
        if (!dailyProfit[dateKey]) {
            dailyProfit[dateKey] = { revenue: 0, cost: 0 };
        }
        dailyProfit[dateKey].revenue += order.grandTotal;
        order.items.forEach((item) => {
            const costPrice = item.product?.costPrice || 0;
            dailyProfit[dateKey].cost += costPrice * item.quantity;
        });
    });
    const result = Object.entries(dailyProfit)
        .map(([date, data]) => {
        const netProfit = data.revenue - data.cost;
        const margin = data.revenue > 0 ? (netProfit / data.revenue) * 100 : 0;
        return {
            date,
            netProfit,
            margin: Math.round(margin * 100) / 100,
        };
    })
        .sort((a, b) => a.date.localeCompare(b.date));
    res.status(200).json(new ApiResponse(200, result));
});
// @desc    Get tax report
// @route   GET /api/reports/tax
export const getTaxReport = asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;
    const query = { storeId: req.tenantId, status: 'Completed' };
    if (startDate && endDate) {
        query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    const orders = await Order.find(query);
    const taxSummary = orders.reduce((acc, order) => {
        acc.totalTax += order.taxTotal;
        acc.taxableAmount += order.grandTotal - order.taxTotal;
        return acc;
    }, { totalTax: 0, taxableAmount: 0 });
    res.status(200).json(new ApiResponse(200, taxSummary));
});
// @desc    Get inventory valuation report
// @route   GET /api/reports/inventory
export const getInventoryReport = asyncHandler(async (req, res) => {
    const cacheKey = `analytics:inventory-report:${req.tenantId}`;
    const { value: result } = await withCache(cacheKey, 60, async () => {
        const inventory = await Inventory.find({ store: req.tenantId }).populate({
            path: 'product',
            populate: { path: 'category', select: 'name' },
        });
        const byCategory = {};
        let lowStockCount = 0;
        let outOfStockCount = 0;
        const stats = inventory.reduce((acc, item) => {
            const cost = (item.product?.costPrice || 0) * item.quantity;
            const value = (item.product?.price || 0) * item.quantity;
            acc.totalItems += item.quantity;
            acc.totalCostValue += cost;
            acc.totalRetailValue += value;
            acc.potentialProfit += value - cost;
            const categoryName = item.product?.category?.name || 'Uncategorized';
            if (!byCategory[categoryName]) {
                byCategory[categoryName] = { category: categoryName, totalValue: 0, totalQuantity: 0 };
            }
            byCategory[categoryName].totalValue += value;
            byCategory[categoryName].totalQuantity += item.quantity;
            if (item.quantity === 0)
                outOfStockCount++;
            else if (item.quantity <= (item.lowStockThreshold || 10))
                lowStockCount++;
            return acc;
        }, { totalItems: 0, totalCostValue: 0, totalRetailValue: 0, potentialProfit: 0 });
        return {
            ...stats,
            totalProducts: inventory.length,
            lowStockCount,
            outOfStockCount,
            byCategory: Object.values(byCategory).sort((a, b) => b.totalValue - a.totalValue),
        };
    });
    res.status(200).json(new ApiResponse(200, result));
});
// @desc    Get customer insights report
// @route   GET /api/reports/customers
export const getCustomerReport = asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;
    const query = { storeId: req.tenantId, status: 'Completed' };
    if (startDate && endDate) {
        query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    const orders = await Order.find(query).populate('customer');
    const customerStats = {};
    orders.forEach((order) => {
        if (order.customer) {
            const customerId = order.customer._id.toString();
            if (!customerStats[customerId]) {
                customerStats[customerId] = {
                    name: order.customer.name,
                    phone: order.customer.phone,
                    orderCount: 0,
                    totalSpent: 0,
                };
            }
            customerStats[customerId].orderCount += 1;
            customerStats[customerId].totalSpent += order.grandTotal;
        }
    });
    const topCustomers = Object.values(customerStats)
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, 10);
    const totalCustomers = await Customer.countDocuments({ storeId: req.tenantId });
    res.status(200).json(new ApiResponse(200, {
        totalCustomers,
        activeCustomersInPeriod: Object.keys(customerStats).length,
        topCustomers,
    }));
});
// @desc    Get revenue trends (Revenue report)
// @route   GET /api/reports/revenue
export const getRevenueReport = asyncHandler(async (req, res) => {
    const { startDate, endDate, interval = 'day' } = req.query;
    const query = { storeId: req.tenantId, status: 'Completed' };
    if (startDate && endDate) {
        query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    const orders = await Order.find(query);
    // Grouping logic for trends
    const trends = {};
    orders.forEach((order) => {
        const date = new Date(order.createdAt);
        let key = '';
        if (interval === 'day')
            key = date.toISOString().split('T')[0];
        else if (interval === 'hour')
            key = `${date.toISOString().split('T')[0]} ${date.getHours()}:00`;
        else if (interval === 'month')
            key = `${date.getFullYear()}-${date.getMonth() + 1}`;
        trends[key] = (trends[key] || 0) + order.grandTotal;
    });
    const result = Object.entries(trends).map(([name, total]) => ({ name, total }));
    res.status(200).json(new ApiResponse(200, result));
});
// @desc    Get top selling products
// @route   GET /api/reports/top-products
export const getTopSellingProducts = asyncHandler(async (req, res) => {
    const { startDate, endDate, limit = 5 } = req.query;
    const query = { storeId: req.tenantId, status: 'Completed' };
    if (startDate && endDate) {
        query.createdAt = {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
        };
    }
    const orders = await Order.find(query);
    const productSales = {};
    orders.forEach((order) => {
        order.items.forEach((item) => {
            const productId = item.product.toString();
            if (!productSales[productId]) {
                productSales[productId] = { name: item.name, quantity: 0, revenue: 0 };
            }
            productSales[productId].quantity += item.quantity;
            productSales[productId].revenue += item.total;
        });
    });
    const topProducts = Object.values(productSales)
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, Number(limit));
    res.status(200).json(new ApiResponse(200, topProducts));
});
// @desc    Get low stock alert report
// @route   GET /api/reports/low-stock
export const getLowStockReport = asyncHandler(async (req, res) => {
    const threshold = parseInt(req.query.threshold) || 10;
    const lowStock = await Inventory.find({
        store: req.tenantId,
        quantity: { $lte: threshold },
    }).populate('product', 'name sku price');
    res.status(200).json(new ApiResponse(200, lowStock));
});
// @desc    Get dead stock report (not sold in X days)
// @route   GET /api/reports/dead-stock
export const getDeadStockReport = asyncHandler(async (req, res) => {
    const days = parseInt(req.query.days) || 30;
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - days);
    // 1. Get all products sold in the last X days
    const activeProductIds = await Order.distinct('items.product', {
        storeId: req.tenantId,
        createdAt: { $gte: dateLimit },
        status: 'Completed',
    });
    // 2. Find products in inventory that ARE NOT in that list
    const deadStock = await Inventory.find({
        store: req.tenantId,
        product: { $nin: activeProductIds },
        quantity: { $gt: 0 },
    }).populate('product', 'name sku price category');
    res.status(200).json(new ApiResponse(200, deadStock));
});
// @desc    Get tax compliance report
// @route   GET /api/reports/tax-compliance
export const getTaxComplianceReport = asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;
    const query = { storeId: req.tenantId, status: 'Completed' };
    if (startDate && endDate) {
        query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    const orders = await Order.find(query);
    const complianceSummary = orders.reduce((acc, order) => {
        acc.totalTaxCollected += order.taxTotal;
        acc.grossSales += order.grandTotal;
        acc.netSales += order.grandTotal - order.taxTotal;
        // Assuming order has tax breakdown, optionally we can expand this
        return acc;
    }, { totalTaxCollected: 0, grossSales: 0, netSales: 0, orderCount: orders.length });
    res.status(200).json(new ApiResponse(200, complianceSummary));
});
// @desc    Get cash & payment-method reconciliation report across shifts
// @route   GET /api/reports/cash-reconciliation
export const getCashReconciliationReport = asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;
    const query = { storeId: req.tenantId, status: 'Closed' };
    if (startDate && endDate) {
        query.endTime = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    const shifts = await Shift.find(query).populate('userId', 'name email').sort({ endTime: -1 });
    const totals = shifts.reduce((acc, s) => {
        acc.totalCashSales += s.totalCashSales || 0;
        acc.totalCardSales += s.totalCardSales || 0;
        acc.totalUpiSales += s.totalUpiSales || 0;
        acc.totalWalletSales += s.totalWalletSales || 0;
        acc.totalRefunds += s.totalRefunds || 0;
        acc.totalDiscrepancy += s.discrepancy || 0;
        acc.shiftsWithMismatch += Math.abs(s.discrepancy || 0) > 0.01 ? 1 : 0;
        return acc;
    }, {
        totalCashSales: 0,
        totalCardSales: 0,
        totalUpiSales: 0,
        totalWalletSales: 0,
        totalRefunds: 0,
        totalDiscrepancy: 0,
        shiftsWithMismatch: 0,
    });
    res.status(200).json(new ApiResponse(200, {
        summary: { ...totals, shiftCount: shifts.length },
        shifts: shifts.map((s) => ({
            _id: s._id,
            cashier: s.userId?.name || 'Unknown',
            startTime: s.startTime,
            endTime: s.endTime,
            startingCash: s.startingCash,
            expectedCash: s.expectedCash,
            actualCash: s.actualCash,
            discrepancy: s.discrepancy,
            totalCashSales: s.totalCashSales,
            totalCardSales: s.totalCardSales,
            totalUpiSales: s.totalUpiSales,
            totalWalletSales: s.totalWalletSales,
            totalRefunds: s.totalRefunds,
        })),
    }));
});
// @desc    Get sales audit trail
// @route   GET /api/reports/audit/sales
export const getSalesAuditTrail = asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;
    const query = { storeId: req.tenantId, entity: 'Order' };
    if (startDate && endDate) {
        query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    const auditLogs = await AuditLog.find(query).populate('userId', 'name email').sort({ createdAt: -1 }).limit(100);
    res.status(200).json(new ApiResponse(200, auditLogs));
});
// @desc    Get inventory audit report
// @route   GET /api/reports/audit/inventory
export const getInventoryAuditReport = asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;
    const query = { storeId: req.tenantId };
    if (startDate && endDate) {
        query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    const adjustments = await StockAdjustment.find(query)
        .populate('productId', 'name sku')
        .populate('createdBy', 'name')
        .sort({ createdAt: -1 })
        .limit(100);
    res.status(200).json(new ApiResponse(200, adjustments));
});
// @desc    Queue background report generation
// @route   POST /api/reports/queue
export const queueReport = asyncHandler(async (req, res) => {
    const { type, filters, format = 'pdf' } = req.body;
    await addReportJob({
        tenantId: req.tenantId,
        type,
        filters,
        format,
        userId: req.user?._id,
    });
    res.status(202).json(new ApiResponse(202, null, 'Report generation job started in background'));
});
// @desc    Export report as Excel, PDF or CSV
// @route   GET /api/reports/export
export const exportReport = asyncHandler(async (req, res) => {
    const { type, startDate, endDate, format = 'excel' } = req.query;
    const query = { storeId: req.tenantId, status: 'Completed' };
    if (startDate && endDate) {
        query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    if (format === 'pdf') {
        const doc = new PDFDocument();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=report-${type}-${Date.now()}.pdf`);
        doc.pipe(res);
        doc.fontSize(20).text(`Store360 ${String(type).toUpperCase()} Report`, { align: 'center' });
        doc.moveDown();
        if (type === 'sales') {
            const orders = await Order.find(query);
            orders.forEach((order) => {
                doc.fontSize(10).text(`Order ID: ${order.orderNumber} | Total: ${order.grandTotal.toFixed(2)} | Date: ${new Date(order.createdAt).toLocaleDateString()}`);
                doc.moveDown(0.5);
            });
        }
        else if (type === 'inventory') {
            const items = await Inventory.find({ store: req.tenantId }).populate('product');
            items.forEach((item) => {
                doc.fontSize(10).text(`Product: ${item.product?.name} | SKU: ${item.product?.sku} | Stock: ${item.quantity}`);
                doc.moveDown(0.5);
            });
        }
        else if (type === 'profit') {
            const orders = await Order.find(query).populate('items.product');
            let revenue = 0;
            let cost = 0;
            orders.forEach((o) => {
                revenue += o.grandTotal;
                o.items.forEach((i) => (cost += (i.product?.costPrice || 0) * i.quantity));
            });
            doc.fontSize(12).text(`Total Revenue: ${revenue.toFixed(2)}`);
            doc.text(`Total Cost: ${cost.toFixed(2)}`);
            doc.text(`Gross Profit: ${(revenue - cost).toFixed(2)}`);
        }
        else if (type === 'tax-compliance') {
            const orders = await Order.find(query);
            let tax = 0, gross = 0;
            orders.forEach((o) => {
                tax += o.taxTotal;
                gross += o.grandTotal;
            });
            doc.fontSize(12).text(`Gross Sales: ${gross.toFixed(2)}`);
            doc.text(`Net Sales: ${(gross - tax).toFixed(2)}`);
            doc.text(`Total Tax Collected: ${tax.toFixed(2)}`);
        }
        else if (type === 'sales-audit') {
            const logs = await AuditLog.find({ storeId: req.tenantId, entity: 'Order' })
                .populate('userId', 'name')
                .limit(100);
            logs.forEach((log) => {
                doc.fontSize(10).text(`Action: ${log.action} | User: ${log.userId?.name || 'System'} | Date: ${new Date(log.createdAt).toLocaleDateString()}`);
                doc.moveDown(0.5);
            });
        }
        else if (type === 'inventory-audit') {
            const adjs = await StockAdjustment.find({ storeId: req.tenantId })
                .populate('productId', 'name sku')
                .populate('createdBy', 'name')
                .limit(100);
            adjs.forEach((adj) => {
                doc.fontSize(10).text(`Product: ${adj.productId?.name} | Adjustment: ${adj.adjustmentAmount} | Reason: ${adj.reason} | User: ${adj.createdBy?.name}`);
                doc.moveDown(0.5);
            });
        }
        else if (type === 'dead-stock') {
            const activeProductIds = await Order.distinct('items.product', {
                storeId: req.tenantId,
                createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
            });
            const items = await Inventory.find({
                store: req.tenantId,
                product: { $nin: activeProductIds },
                quantity: { $gt: 0 },
            }).populate('product');
            items.forEach((item) => {
                doc.fontSize(10).text(`DEAD STOCK: ${item.product?.name} | SKU: ${item.product?.sku} | Qty: ${item.quantity}`);
                doc.moveDown(0.5);
            });
        }
        else if (type === 'purchases') {
            const poQuery = { storeId: req.tenantId };
            if (startDate && endDate) {
                poQuery.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
            }
            const pos = await PurchaseOrder.find(poQuery).populate('supplier', 'name');
            pos.forEach((po) => {
                doc.fontSize(10).text(`PO: ${po.poNumber} | Supplier: ${po.supplier?.name || 'Unknown'} | Total: ${po.grandTotal.toFixed(2)} | Status: ${po.status} | Date: ${new Date(po.createdAt).toLocaleDateString()}`);
                doc.moveDown(0.5);
            });
        }
        else if (type === 'customer-dues') {
            const customers = await Customer.find({ storeId: req.tenantId, dueBalance: { $gt: 0 } }).sort({
                dueBalance: -1,
            });
            customers.forEach((c) => {
                doc.fontSize(10).text(`${c.name} | Phone: ${c.phone} | Segment: ${c.segment} | Outstanding: ${c.dueBalance.toFixed(2)} | Updated: ${new Date(c.updatedAt).toLocaleDateString()}`);
                doc.moveDown(0.5);
            });
        }
        else if (type === 'cash-reconciliation') {
            const shiftQuery = { storeId: req.tenantId, status: 'Closed' };
            if (startDate && endDate) {
                shiftQuery.endTime = { $gte: new Date(startDate), $lte: new Date(endDate) };
            }
            const shifts = await Shift.find(shiftQuery).populate('userId', 'name').sort({ endTime: -1 });
            shifts.forEach((s) => {
                doc.fontSize(10).text(`Cashier: ${s.userId?.name || 'Unknown'} | Closed: ${s.endTime ? new Date(s.endTime).toLocaleString() : '-'} | Expected Cash: ${(s.expectedCash || 0).toFixed(2)} | Actual Cash: ${(s.actualCash || 0).toFixed(2)} | Discrepancy: ${(s.discrepancy || 0).toFixed(2)}`);
                doc.moveDown(0.5);
            });
        }
        doc.end();
        return;
    }
    // Excel and CSV (CSV via ExcelJS)
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Report');
    if (type === 'sales') {
        const orders = await Order.find(query);
        worksheet.columns = [
            { header: 'Order Number', key: 'orderNumber', width: 20 },
            { header: 'Subtotal', key: 'subTotal', width: 15 },
            { header: 'Tax', key: 'taxTotal', width: 15 },
            { header: 'Grand Total', key: 'grandTotal', width: 15 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Date', key: 'createdAt', width: 25 },
        ];
        orders.forEach((order) => worksheet.addRow({
            ...order.toObject(),
            createdAt: order.createdAt.toISOString(),
        }));
    }
    else if (type === 'inventory') {
        const items = await Inventory.find({ store: req.tenantId }).populate('product');
        worksheet.columns = [
            { header: 'Product Name', key: 'productName', width: 30 },
            { header: 'SKU', key: 'sku', width: 15 },
            { header: 'Stock Quantity', key: 'quantity', width: 15 },
            { header: 'Cost Price', key: 'costPrice', width: 15 },
            { header: 'Retail Price', key: 'price', width: 15 },
        ];
        items.forEach((item) => {
            worksheet.addRow({
                productName: item.product?.name,
                sku: item.product?.sku,
                quantity: item.quantity,
                costPrice: item.product?.costPrice,
                price: item.product?.price,
            });
        });
    }
    else if (type === 'tax-compliance') {
        const orders = await Order.find(query);
        worksheet.columns = [
            { header: 'Order Number', key: 'orderNumber', width: 20 },
            { header: 'Gross Sales', key: 'grandTotal', width: 15 },
            { header: 'Tax Collected', key: 'taxTotal', width: 15 },
            { header: 'Net Sales', key: 'netSales', width: 15 },
            { header: 'Date', key: 'createdAt', width: 25 },
        ];
        orders.forEach((order) => worksheet.addRow({
            orderNumber: order.orderNumber,
            grandTotal: order.grandTotal,
            taxTotal: order.taxTotal,
            netSales: order.grandTotal - order.taxTotal,
            createdAt: order.createdAt.toISOString(),
        }));
    }
    else if (type === 'sales-audit') {
        const logs = await AuditLog.find({ storeId: req.tenantId, entity: 'Order' }).populate('userId', 'name');
        worksheet.columns = [
            { header: 'Action', key: 'action', width: 20 },
            { header: 'Entity ID', key: 'entityId', width: 25 },
            { header: 'User', key: 'user', width: 20 },
            { header: 'Date', key: 'createdAt', width: 25 },
        ];
        logs.forEach((log) => worksheet.addRow({
            action: log.action,
            entityId: log.entityId?.toString(),
            user: log.userId?.name || 'System',
            createdAt: log.createdAt.toISOString(),
        }));
    }
    else if (type === 'inventory-audit') {
        const adjs = await StockAdjustment.find({ storeId: req.tenantId })
            .populate('productId', 'name sku')
            .populate('createdBy', 'name');
        worksheet.columns = [
            { header: 'Product Name', key: 'productName', width: 30 },
            { header: 'SKU', key: 'sku', width: 15 },
            { header: 'Adjustment', key: 'adjustmentAmount', width: 15 },
            { header: 'Reason', key: 'reason', width: 20 },
            { header: 'User', key: 'user', width: 20 },
            { header: 'Date', key: 'createdAt', width: 25 },
        ];
        adjs.forEach((adj) => worksheet.addRow({
            productName: adj.productId?.name,
            sku: adj.productId?.sku,
            adjustmentAmount: adj.adjustmentAmount,
            reason: adj.reason,
            user: adj.createdBy?.name,
            createdAt: adj.createdAt.toISOString(),
        }));
    }
    else if (type === 'dead-stock') {
        const activeProductIds = await Order.distinct('items.product', {
            storeId: req.tenantId,
            createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        });
        const items = await Inventory.find({
            store: req.tenantId,
            product: { $nin: activeProductIds },
            quantity: { $gt: 0 },
        }).populate('product');
        worksheet.columns = [
            { header: 'Product Name', key: 'productName', width: 30 },
            { header: 'SKU', key: 'sku', width: 15 },
            { header: 'Quantity', key: 'quantity', width: 15 },
            { header: 'Value', key: 'value', width: 15 },
        ];
        items.forEach((item) => worksheet.addRow({
            productName: item.product?.name,
            sku: item.product?.sku,
            quantity: item.quantity,
            value: (item.product?.price || 0) * item.quantity,
        }));
    }
    else if (type === 'purchases') {
        const poQuery = { storeId: req.tenantId };
        if (startDate && endDate) {
            poQuery.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
        }
        const pos = await PurchaseOrder.find(poQuery).populate('supplier', 'name');
        worksheet.columns = [
            { header: 'PO Number', key: 'poNumber', width: 20 },
            { header: 'Supplier', key: 'supplier', width: 25 },
            { header: 'Items', key: 'itemCount', width: 10 },
            { header: 'Subtotal', key: 'subTotal', width: 15 },
            { header: 'Tax', key: 'taxTotal', width: 15 },
            { header: 'Grand Total', key: 'grandTotal', width: 15 },
            { header: 'Status', key: 'status', width: 18 },
            { header: 'Date', key: 'createdAt', width: 25 },
        ];
        pos.forEach((po) => worksheet.addRow({
            poNumber: po.poNumber,
            supplier: po.supplier?.name || 'Unknown',
            itemCount: po.items.length,
            subTotal: po.subTotal,
            taxTotal: po.taxTotal,
            grandTotal: po.grandTotal,
            status: po.status,
            createdAt: po.createdAt.toISOString(),
        }));
    }
    else if (type === 'customer-dues') {
        const customers = await Customer.find({ storeId: req.tenantId, dueBalance: { $gt: 0 } }).sort({
            dueBalance: -1,
        });
        worksheet.columns = [
            { header: 'Name', key: 'name', width: 25 },
            { header: 'Phone', key: 'phone', width: 20 },
            { header: 'Segment', key: 'segment', width: 15 },
            { header: 'Outstanding Due', key: 'dueBalance', width: 18 },
            { header: 'Last Updated', key: 'updatedAt', width: 25 },
        ];
        customers.forEach((c) => worksheet.addRow({
            name: c.name,
            phone: c.phone,
            segment: c.segment,
            dueBalance: c.dueBalance,
            updatedAt: c.updatedAt.toISOString(),
        }));
    }
    else if (type === 'cash-reconciliation') {
        const shiftQuery = { storeId: req.tenantId, status: 'Closed' };
        if (startDate && endDate) {
            shiftQuery.endTime = { $gte: new Date(startDate), $lte: new Date(endDate) };
        }
        const shifts = await Shift.find(shiftQuery).populate('userId', 'name').sort({ endTime: -1 });
        worksheet.columns = [
            { header: 'Cashier', key: 'cashier', width: 20 },
            { header: 'Closed At', key: 'endTime', width: 25 },
            { header: 'Starting Cash', key: 'startingCash', width: 15 },
            { header: 'Cash Sales', key: 'totalCashSales', width: 15 },
            { header: 'Card Sales', key: 'totalCardSales', width: 15 },
            { header: 'UPI Sales', key: 'totalUpiSales', width: 15 },
            { header: 'Wallet Sales', key: 'totalWalletSales', width: 15 },
            { header: 'Refunds', key: 'totalRefunds', width: 15 },
            { header: 'Expected Cash', key: 'expectedCash', width: 15 },
            { header: 'Actual Cash', key: 'actualCash', width: 15 },
            { header: 'Discrepancy', key: 'discrepancy', width: 15 },
        ];
        shifts.forEach((s) => worksheet.addRow({
            cashier: s.userId?.name || 'Unknown',
            endTime: s.endTime ? s.endTime.toISOString() : '',
            startingCash: s.startingCash,
            totalCashSales: s.totalCashSales,
            totalCardSales: s.totalCardSales,
            totalUpiSales: s.totalUpiSales,
            totalWalletSales: s.totalWalletSales,
            totalRefunds: s.totalRefunds,
            expectedCash: s.expectedCash,
            actualCash: s.actualCash,
            discrepancy: s.discrepancy,
        }));
    }
    if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=report-${type}-${Date.now()}.csv`);
        await workbook.csv.write(res);
    }
    else {
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=report-${type}-${Date.now()}.xlsx`);
        await workbook.xlsx.write(res);
    }
    res.end();
});
