import { Response } from 'express';
import Customer from '../models/Customer.js';
import Order from '../models/Order.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/apiResponse.js';
import { TenantRequest } from '../middleware/tenantHandler.js';
import ExcelJS from 'exceljs';

// @desc    Add loyalty points to customer
// @route   POST /api/customers/:id/loyalty
export const updateLoyaltyPoints = asyncHandler(async (req: TenantRequest, res: Response) => {
    const { points, action } = req.body; // action: 'add' or 'redeem'

    const customer = await Customer.findOne({ _id: req.params.id, storeId: req.tenantId });
    if (!customer) {
        return res.status(404).json(new ApiResponse(404, null, "Customer not found"));
    }

    if (action === 'redeem' && customer.loyaltyPoints < points) {
        return res.status(400).json(new ApiResponse(400, null, "Insufficient points"));
    }

    const newPoints = action === 'add'
        ? customer.loyaltyPoints + points
        : customer.loyaltyPoints - points;

    customer.loyaltyPoints = newPoints;
    await customer.save();

    res.status(200).json(new ApiResponse(200, customer, `Points ${action}ed successfully`));
});

// @desc    Get all customers
// @route   GET /api/customers
export const getCustomers = asyncHandler(async (req: TenantRequest, res: Response) => {
    const customers = await Customer.find({ storeId: req.tenantId });
    res.status(200).json(new ApiResponse(200, customers));
});

// @desc    Create a new customer
// @route   POST /api/customers
export const createCustomer = asyncHandler(async (req: TenantRequest, res: Response) => {
    const customer = await Customer.create({ ...req.body, storeId: req.tenantId });
    res.status(201).json(new ApiResponse(201, customer));
});

// @desc    Get customer by ID with purchase history
// @route   GET /api/customers/:id
export const getCustomerById = asyncHandler(async (req: TenantRequest, res: Response) => {
    const customer = await Customer.findOne({ _id: req.params.id, storeId: req.tenantId });
    if (!customer) {
        return res.status(404).json(new ApiResponse(404, null, "Customer not found"));
    }

    // Fetch recent orders associated with this customer
    const recentOrders = await Order.find({ customer: customer._id, storeId: req.tenantId })
        .sort('-createdAt')
        .limit(10);

    const totalSpend = await Order.aggregate([
        { $match: { customer: customer._id, storeId: req.tenantId, status: 'Completed' } },
        { $group: { _id: null, total: { $sum: "$grandTotal" } } }
    ]);

    res.status(200).json(new ApiResponse(200, {
        ...customer.toObject(),
        recentOrders,
        totalSpend: totalSpend[0]?.total || 0,
    }));
});

// @desc    Update customer details (notes, tags, segment, etc.)
// @route   PUT /api/customers/:id
export const updateCustomer = asyncHandler(async (req: TenantRequest, res: Response) => {
    const customer = await Customer.findOneAndUpdate(
        { _id: req.params.id, storeId: req.tenantId },
        { $set: req.body },
        { new: true, runValidators: true }
    );

    if (!customer) {
        return res.status(404).json(new ApiResponse(404, null, "Customer not found"));
    }

    res.status(200).json(new ApiResponse(200, customer, "Customer updated successfully"));
});

// @desc    Delete a customer
// @route   DELETE /api/customers/:id
export const deleteCustomer = asyncHandler(async (req: TenantRequest, res: Response) => {
    const customer = await Customer.findOneAndDelete({ _id: req.params.id, storeId: req.tenantId });
    if (!customer) {
        return res.status(404).json(new ApiResponse(404, null, "Customer not found"));
    }
    res.status(200).json(new ApiResponse(200, null, "Customer deleted successfully"));
});

// @desc    Update customer wallet balance
// @route   POST /api/customers/:id/wallet
export const updateWalletBalance = asyncHandler(async (req: TenantRequest, res: Response) => {
    const { amount, action } = req.body; // action: 'add' or 'deduct'

    if (!amount || amount <= 0) {
        return res.status(400).json(new ApiResponse(400, null, "Invalid amount"));
    }

    const customer = await Customer.findOne({ _id: req.params.id, storeId: req.tenantId });
    if (!customer) {
        return res.status(404).json(new ApiResponse(404, null, "Customer not found"));
    }

    if (action === 'deduct' && customer.walletBalance < amount) {
        return res.status(400).json(new ApiResponse(400, null, "Insufficient wallet balance"));
    }

    const newBalance = action === 'add'
        ? customer.walletBalance + amount
        : customer.walletBalance - amount;

    customer.walletBalance = newBalance;
    await customer.save();

    res.status(200).json(new ApiResponse(200, customer, `Wallet ${action}ed successfully. New Balance: ${newBalance}`));
});

// @desc    Get top-level customer CRM analytics
// @route   GET /api/customers/analytics/summary
export const getCustomerAnalytics = asyncHandler(async (req: TenantRequest, res: Response) => {
    const storeId = req.tenantId;

    const totalCustomers = await Customer.countDocuments({ storeId });

    // Customers created in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const newCustomers = await Customer.countDocuments({
        storeId,
        createdAt: { $gte: thirtyDaysAgo }
    });

    // Customers who bought more than once (Retention heuristic)
    const repeatBuyersAggr = await Order.aggregate([
        { $match: { storeId, status: 'Completed', customer: { $exists: true, $ne: null } } },
        { $group: { _id: "$customer", purchaseCount: { $sum: 1 } } },
        { $match: { purchaseCount: { $gt: 1 } } },
        { $count: "repeatBuyers" }
    ]);
    const repeatBuyersCount = repeatBuyersAggr[0]?.repeatBuyers || 0;

    const retentionRate = totalCustomers > 0 ? ((repeatBuyersCount / totalCustomers) * 100).toFixed(1) : 0;

    res.status(200).json(new ApiResponse(200, {
        totalCustomers,
        newCustomers,
        repeatBuyersCount,
        retentionRate,
    }));
});

// @desc    Export Customers to Excel
// @route   GET /api/customers/export
export const exportCustomers = asyncHandler(async (req: TenantRequest, res: Response) => {
    const customers = await Customer.find({ storeId: req.tenantId }).sort('-createdAt');

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Customers');

    worksheet.columns = [
        { header: 'Name', key: 'name', width: 25 },
        { header: 'Phone', key: 'phone', width: 20 },
        { header: 'Email', key: 'email', width: 25 },
        { header: 'Segment', key: 'segment', width: 15 },
        { header: 'Loyalty Points', key: 'loyaltyPoints', width: 15 },
        { header: 'Wallet Balance', key: 'walletBalance', width: 15 },
        { header: 'Notes', key: 'notes', width: 30 }
    ];

    customers.forEach(customer => {
        worksheet.addRow({
            name: customer.name,
            phone: customer.phone,
            email: customer.email || '',
            segment: customer.segment,
            loyaltyPoints: customer.loyaltyPoints,
            walletBalance: customer.walletBalance,
            notes: customer.notes || ''
        });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=' + 'customers_export.xlsx');

    await workbook.xlsx.write(res);
    res.end();
});

// @desc    Import Customers from Excel 
// @route   POST /api/customers/import
export const importCustomers = asyncHandler(async (req: TenantRequest, res: Response) => {
    if (!req.file) {
        return res.status(400).json(new ApiResponse(400, null, "Please upload an Excel file"));
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const worksheet = workbook.worksheets[0];

    const customersToInsert: any[] = [];
    const storeId = req.tenantId;

    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) { // Skip Header
            const phone = row.getCell(2).value?.toString() || '';
            if (phone) {
                customersToInsert.push({
                    name: row.getCell(1).value?.toString() || 'Unknown',
                    phone: phone,
                    email: row.getCell(3).value?.toString() || undefined,
                    segment: row.getCell(4).value?.toString() || 'Retail',
                    notes: row.getCell(7).value?.toString() || '',
                    storeId
                });
            }
        }
    });

    if (customersToInsert.length === 0) {
        return res.status(400).json(new ApiResponse(400, null, "No valid data found in file"));
    }

    // Upsert logic (Match by phone + storeId)
    const bulkOps = customersToInsert.map(cust => ({
        updateOne: {
            filter: { phone: cust.phone, storeId: cust.storeId },
            update: { $set: cust },
            upsert: true
        }
    }));

    await Customer.bulkWrite(bulkOps);

    res.status(200).json(new ApiResponse(200, { imported: customersToInsert.length }, "Customers imported successfully"));
});
