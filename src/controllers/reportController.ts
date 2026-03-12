import { Response } from 'express';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Inventory from '../models/Inventory.js';
import Customer from '../models/Customer.js';
import AuditLog from '../models/AuditLog.js';
import StockAdjustment from '../models/StockAdjustment.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/apiResponse.js';
import { TenantRequest } from '../middleware/tenantHandler.js';
import { addReportJob } from '../queues/reportQueue.js';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

// @desc    Get sales analytics for store
// @route   GET /api/reports/sales
export const getSalesReport = asyncHandler(async (req: TenantRequest, res: Response) => {
    const { startDate, endDate } = req.query;

    const query: any = { storeId: req.tenantId, status: 'Completed' };
    if (startDate && endDate) {
        query.createdAt = {
            $gte: new Date(startDate as string),
            $lte: new Date(endDate as string)
        };
    }

    const orders = await Order.find(query);

    const stats = {
        totalRevenue: orders.reduce((acc, o) => acc + o.grandTotal, 0),
        totalOrders: orders.length,
        totalItemsSold: orders.reduce((acc, o) => acc + o.items.reduce((sum, i) => sum + i.quantity, 0), 0),
        averageOrderValue: orders.length > 0 ? orders.reduce((acc, o) => acc + o.grandTotal, 0) / orders.length : 0,
        taxTotal: orders.reduce((acc, o) => acc + (o.taxTotal || 0), 0),
        discountTotal: orders.reduce((acc, o) => acc + (o.discountTotal || 0), 0)
    };

    res.status(200).json(new ApiResponse(200, stats));
});

// @desc    Get profit and loss report
// @route   GET /api/reports/profit
export const getProfitReport = asyncHandler(async (req: TenantRequest, res: Response) => {
    const { startDate, endDate } = req.query;
    const query: any = { storeId: req.tenantId, status: 'Completed' };

    if (startDate && endDate) {
        query.createdAt = { $gte: new Date(startDate as string), $lte: new Date(endDate as string) };
    }

    const orders = await Order.find(query).populate('items.product');

    let totalRevenue = 0;
    let totalCost = 0;

    orders.forEach(order => {
        totalRevenue += order.grandTotal;
        order.items.forEach((item: any) => {
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
export const getTaxReport = asyncHandler(async (req: TenantRequest, res: Response) => {
    const { startDate, endDate } = req.query;
    const query: any = { storeId: req.tenantId, status: 'Completed' };

    if (startDate && endDate) {
        query.createdAt = { $gte: new Date(startDate as string), $lte: new Date(endDate as string) };
    }

    const orders = await Order.find(query);

    const taxSummary = orders.reduce((acc, order) => {
        acc.totalTax += order.taxTotal;
        acc.taxableAmount += (order.grandTotal - order.taxTotal);
        return acc;
    }, { totalTax: 0, taxableAmount: 0 });

    res.status(200).json(new ApiResponse(200, taxSummary));
});

// @desc    Get inventory valuation report
// @route   GET /api/reports/inventory
export const getInventoryReport = asyncHandler(async (req: TenantRequest, res: Response) => {
    const inventory = await Inventory.find({ store: req.tenantId }).populate('product');

    const stats = inventory.reduce((acc, item: any) => {
        const cost = (item.product?.costPrice || 0) * item.quantity;
        const value = (item.product?.price || 0) * item.quantity;
        acc.totalItems += item.quantity;
        acc.totalCostValue += cost;
        acc.totalRetailValue += value;
        acc.potentialProfit += (value - cost);
        return acc;
    }, { totalItems: 0, totalCostValue: 0, totalRetailValue: 0, potentialProfit: 0 });

    res.status(200).json(new ApiResponse(200, stats));
});

// @desc    Get customer insights report
// @route   GET /api/reports/customers
export const getCustomerReport = asyncHandler(async (req: TenantRequest, res: Response) => {
    const { startDate, endDate } = req.query;
    const query: any = { storeId: req.tenantId, status: 'Completed' };

    if (startDate && endDate) {
        query.createdAt = { $gte: new Date(startDate as string), $lte: new Date(endDate as string) };
    }

    const orders = await Order.find(query).populate('customer');

    const customerStats: Record<string, any> = {};

    orders.forEach(order => {
        if (order.customer) {
            const customerId = order.customer._id.toString();
            if (!customerStats[customerId]) {
                customerStats[customerId] = {
                    name: (order.customer as any).name,
                    phone: (order.customer as any).phone,
                    orderCount: 0,
                    totalSpent: 0
                };
            }
            customerStats[customerId].orderCount += 1;
            customerStats[customerId].totalSpent += order.grandTotal;
        }
    });

    const topCustomers = Object.values(customerStats)
        .sort((a: any, b: any) => b.totalSpent - a.totalSpent)
        .slice(0, 10);

    const totalCustomers = await Customer.countDocuments({ storeId: req.tenantId });

    res.status(200).json(new ApiResponse(200, {
        totalCustomers,
        activeCustomersInPeriod: Object.keys(customerStats).length,
        topCustomers
    }));
});

// @desc    Get revenue trends (Revenue report)
// @route   GET /api/reports/revenue
export const getRevenueReport = asyncHandler(async (req: TenantRequest, res: Response) => {
    const { startDate, endDate, interval = 'day' } = req.query;
    const query: any = { storeId: req.tenantId, status: 'Completed' };

    if (startDate && endDate) {
        query.createdAt = { $gte: new Date(startDate as string), $lte: new Date(endDate as string) };
    }

    const orders = await Order.find(query);

    // Grouping logic for trends
    const trends: Record<string, number> = {};
    orders.forEach(order => {
        const date = new Date(order.createdAt);
        let key = '';
        if (interval === 'day') key = date.toISOString().split('T')[0];
        else if (interval === 'hour') key = `${date.toISOString().split('T')[0]} ${date.getHours()}:00`;
        else if (interval === 'month') key = `${date.getFullYear()}-${date.getMonth() + 1}`;

        trends[key] = (trends[key] || 0) + order.grandTotal;
    });

    const result = Object.entries(trends).map(([name, total]) => ({ name, total }));

    res.status(200).json(new ApiResponse(200, result));
});

// @desc    Get low stock alert report
// @route   GET /api/reports/low-stock
export const getLowStockReport = asyncHandler(async (req: TenantRequest, res: Response) => {
    const threshold = parseInt(req.query.threshold as string) || 10;

    const lowStock = await Inventory.find({
        store: req.tenantId,
        quantity: { $lte: threshold }
    }).populate('product', 'name sku price');

    res.status(200).json(new ApiResponse(200, lowStock));
});

// @desc    Get tax compliance report
// @route   GET /api/reports/tax-compliance
export const getTaxComplianceReport = asyncHandler(async (req: TenantRequest, res: Response) => {
    const { startDate, endDate } = req.query;
    const query: any = { storeId: req.tenantId, status: 'Completed' };

    if (startDate && endDate) {
        query.createdAt = { $gte: new Date(startDate as string), $lte: new Date(endDate as string) };
    }

    const orders = await Order.find(query);

    const complianceSummary = orders.reduce((acc, order) => {
        acc.totalTaxCollected += order.taxTotal;
        acc.grossSales += order.grandTotal;
        acc.netSales += (order.grandTotal - order.taxTotal);
        // Assuming order has tax breakdown, optionally we can expand this
        return acc;
    }, { totalTaxCollected: 0, grossSales: 0, netSales: 0, orderCount: orders.length });

    res.status(200).json(new ApiResponse(200, complianceSummary));
});

// @desc    Get sales audit trail
// @route   GET /api/reports/audit/sales
export const getSalesAuditTrail = asyncHandler(async (req: TenantRequest, res: Response) => {
    const { startDate, endDate } = req.query;
    const query: any = { storeId: req.tenantId, entity: 'Order' };

    if (startDate && endDate) {
        query.createdAt = { $gte: new Date(startDate as string), $lte: new Date(endDate as string) };
    }

    const auditLogs = await AuditLog.find(query)
        .populate('userId', 'name email')
        .sort({ createdAt: -1 })
        .limit(100);

    res.status(200).json(new ApiResponse(200, auditLogs));
});

// @desc    Get inventory audit report
// @route   GET /api/reports/audit/inventory
export const getInventoryAuditReport = asyncHandler(async (req: TenantRequest, res: Response) => {
    const { startDate, endDate } = req.query;
    const query: any = { storeId: req.tenantId };

    if (startDate && endDate) {
        query.createdAt = { $gte: new Date(startDate as string), $lte: new Date(endDate as string) };
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
export const queueReport = asyncHandler(async (req: TenantRequest, res: Response) => {
    const { type, filters, format = 'pdf' } = req.body;
    await addReportJob({
        tenantId: req.tenantId as any,
        type,
        filters,
        format,
        userId: (req as any).user?._id
    });
    res.status(202).json(new ApiResponse(202, null, "Report generation job started in background"));
});

// @desc    Export report as Excel, PDF or CSV
// @route   GET /api/reports/export
export const exportReport = asyncHandler(async (req: TenantRequest, res: Response) => {
    const { type, startDate, endDate, format = 'excel' } = req.query;
    const query: any = { storeId: req.tenantId, status: 'Completed' };

    if (startDate && endDate) {
        query.createdAt = { $gte: new Date(startDate as string), $lte: new Date(endDate as string) };
    }

    if (format === 'pdf') {
        const doc = new PDFDocument();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=report-${type}-${Date.now()}.pdf`);

        doc.pipe(res);
        doc.fontSize(20).text(`RetailSync ${String(type).toUpperCase()} Report`, { align: 'center' });
        doc.moveDown();

        if (type === 'sales') {
            const orders = await Order.find(query);
            orders.forEach(order => {
                doc.fontSize(10).text(`Order ID: ${order.orderNumber} | Total: ${order.grandTotal.toFixed(2)} | Date: ${new Date(order.createdAt).toLocaleDateString()}`);
                doc.moveDown(0.5);
            });
        } else if (type === 'inventory') {
            const items = await Inventory.find({ store: req.tenantId }).populate('product');
            items.forEach((item: any) => {
                doc.fontSize(10).text(`Product: ${item.product?.name} | SKU: ${item.product?.sku} | Stock: ${item.quantity}`);
                doc.moveDown(0.5);
            });
        } else if (type === 'profit') {
            const orders = await Order.find(query).populate('items.product');
            let revenue = 0; let cost = 0;
            orders.forEach(o => {
                revenue += o.grandTotal;
                o.items.forEach((i: any) => cost += (i.product?.costPrice || 0) * i.quantity);
            });
            doc.fontSize(12).text(`Total Revenue: ${revenue.toFixed(2)}`);
            doc.text(`Total Cost: ${cost.toFixed(2)}`);
            doc.text(`Gross Profit: ${(revenue - cost).toFixed(2)}`);
        } else if (type === 'tax-compliance') {
            const orders = await Order.find(query);
            let tax = 0, gross = 0;
            orders.forEach(o => { tax += o.taxTotal; gross += o.grandTotal; });
            doc.fontSize(12).text(`Gross Sales: ${gross.toFixed(2)}`);
            doc.text(`Net Sales: ${(gross - tax).toFixed(2)}`);
            doc.text(`Total Tax Collected: ${tax.toFixed(2)}`);
        } else if (type === 'sales-audit') {
            const logs = await AuditLog.find({ storeId: req.tenantId, entity: 'Order' })
                .populate('userId', 'name')
                .limit(100);
            logs.forEach((log: any) => {
                doc.fontSize(10).text(`Action: ${log.action} | User: ${log.userId?.name || 'System'} | Date: ${new Date(log.createdAt).toLocaleDateString()}`);
                doc.moveDown(0.5);
            });
        } else if (type === 'inventory-audit') {
            const adjs = await StockAdjustment.find({ storeId: req.tenantId })
                .populate('productId', 'name sku')
                .populate('createdBy', 'name')
                .limit(100);
            adjs.forEach((adj: any) => {
                doc.fontSize(10).text(`Product: ${adj.productId?.name} | Adjustment: ${adj.adjustmentAmount} | Reason: ${adj.reason} | User: ${adj.createdBy?.name}`);
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
            { header: 'Date', key: 'createdAt', width: 25 }
        ];
        orders.forEach(order => worksheet.addRow({
            ...order.toObject(),
            createdAt: order.createdAt.toISOString()
        }));
    } else if (type === 'inventory') {
        const items = await Inventory.find({ store: req.tenantId }).populate('product');
        worksheet.columns = [
            { header: 'Product Name', key: 'productName', width: 30 },
            { header: 'SKU', key: 'sku', width: 15 },
            { header: 'Stock Quantity', key: 'quantity', width: 15 },
            { header: 'Cost Price', key: 'costPrice', width: 15 },
            { header: 'Retail Price', key: 'price', width: 15 }
        ];
        items.forEach((item: any) => {
            worksheet.addRow({
                productName: item.product?.name,
                sku: item.product?.sku,
                quantity: item.quantity,
                costPrice: item.product?.costPrice,
                price: item.product?.price
            });
        });
    } else if (type === 'tax-compliance') {
        const orders = await Order.find(query);
        worksheet.columns = [
            { header: 'Order Number', key: 'orderNumber', width: 20 },
            { header: 'Gross Sales', key: 'grandTotal', width: 15 },
            { header: 'Tax Collected', key: 'taxTotal', width: 15 },
            { header: 'Net Sales', key: 'netSales', width: 15 },
            { header: 'Date', key: 'createdAt', width: 25 }
        ];
        orders.forEach(order => worksheet.addRow({
            orderNumber: order.orderNumber,
            grandTotal: order.grandTotal,
            taxTotal: order.taxTotal,
            netSales: order.grandTotal - order.taxTotal,
            createdAt: order.createdAt.toISOString()
        }));
    } else if (type === 'sales-audit') {
        const logs = await AuditLog.find({ storeId: req.tenantId, entity: 'Order' }).populate('userId', 'name');
        worksheet.columns = [
            { header: 'Action', key: 'action', width: 20 },
            { header: 'Entity ID', key: 'entityId', width: 25 },
            { header: 'User', key: 'user', width: 20 },
            { header: 'Date', key: 'createdAt', width: 25 }
        ];
        logs.forEach((log: any) => worksheet.addRow({
            action: log.action,
            entityId: log.entityId?.toString(),
            user: log.userId?.name || 'System',
            createdAt: log.createdAt.toISOString()
        }));
    } else if (type === 'inventory-audit') {
        const adjs = await StockAdjustment.find({ storeId: req.tenantId })
            .populate('productId', 'name sku')
            .populate('createdBy', 'name');
        worksheet.columns = [
            { header: 'Product Name', key: 'productName', width: 30 },
            { header: 'SKU', key: 'sku', width: 15 },
            { header: 'Adjustment', key: 'adjustmentAmount', width: 15 },
            { header: 'Reason', key: 'reason', width: 20 },
            { header: 'User', key: 'user', width: 20 },
            { header: 'Date', key: 'createdAt', width: 25 }
        ];
        adjs.forEach((adj: any) => worksheet.addRow({
            productName: adj.productId?.name,
            sku: adj.productId?.sku,
            adjustmentAmount: adj.adjustmentAmount,
            reason: adj.reason,
            user: adj.createdBy?.name,
            createdAt: adj.createdAt.toISOString()
        }));
    }

    if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=report-${type}-${Date.now()}.csv`);
        await workbook.csv.write(res);
    } else {
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=report-${type}-${Date.now()}.xlsx`);
        await workbook.xlsx.write(res);
    }
    res.end();
});

