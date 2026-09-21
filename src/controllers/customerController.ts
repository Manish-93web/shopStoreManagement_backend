import { Response } from 'express';
import mongoose from 'mongoose';
import Customer from '../models/Customer.js';
import Order from '../models/Order.js';
import Wallet from '../models/Wallet.js';
import CustomerDue from '../models/CustomerDue.js';
import AuditLog from '../models/AuditLog.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/apiResponse.js';
import { TenantRequest } from '../middleware/tenantHandler.js';
import ExcelJS from 'exceljs';
import redisClient from '../config/redis.js';

// @desc    Add loyalty points to customer
// @route   POST /api/customers/:id/loyalty
export const updateLoyaltyPoints = asyncHandler(async (req: TenantRequest, res: Response) => {
    const { points, action } = req.body; // action: 'add' or 'redeem'

    const customer = await Customer.findOne({ _id: req.params.id, storeId: req.tenantId });
    if (!customer) {
        return res.status(404).json(new ApiResponse(404, null, 'Customer not found'));
    }

    if (action === 'redeem' && customer.loyaltyPoints < points) {
        return res.status(400).json(new ApiResponse(400, null, 'Insufficient points'));
    }

    const newPoints = action === 'add' ? customer.loyaltyPoints + points : customer.loyaltyPoints - points;

    customer.loyaltyPoints = newPoints;
    await customer.save();

    await AuditLog.create({
        userId: req.user?._id,
        storeId: req.tenantId,
        action: action === 'add' ? 'LOYALTY_POINTS_ADDED' : 'LOYALTY_POINTS_REDEEMED',
        entity: 'Customer',
        entityId: customer._id,
        details: `${action === 'add' ? 'Added' : 'Redeemed'} ${points} loyalty points. New balance: ${newPoints}`,
    });

    res.status(200).json(new ApiResponse(200, customer, `Points ${action}ed successfully`));
});

// @desc    Get all customers
// @route   GET /api/customers
export const getCustomers = asyncHandler(async (req: TenantRequest, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    const search = (req.query.search as string)?.trim();
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    const cacheKey = `customers:${req.tenantId}:p${page}:l${limit}:s${search || ''}:d${startDate || ''}-${endDate || ''}`;
    if (process.env.SKIP_REDIS !== 'true') {
        const cached = await redisClient.get(cacheKey);
        if (cached) return res.status(200).json(new ApiResponse(200, JSON.parse(cached), 'Customers from cache'));
    }

    const query: any = { storeId: req.tenantId };
    if (search) {
        query.$or = [
            { name: { $regex: search, $options: 'i' } },
            { phone: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
        ];
    }
    if (startDate && endDate) {
        query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const customers = await Customer.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();

    const total = await Customer.countDocuments(query);

    const response = {
        customers,
        pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
        },
    };

    if (process.env.SKIP_REDIS !== 'true') {
        await redisClient.setEx(cacheKey, 300, JSON.stringify(response));
    }

    res.status(200).json(new ApiResponse(200, response));
});

// @desc    Create a new customer
// @route   POST /api/customers
export const createCustomer = asyncHandler(async (req: TenantRequest, res: Response) => {
    const customer = await Customer.create({ ...req.body, storeId: req.tenantId });

    await AuditLog.create({
        userId: req.user?._id,
        storeId: req.tenantId,
        action: 'CREATED_CUSTOMER',
        entity: 'Customer',
        entityId: customer._id,
        details: `Created customer ${customer.name}`,
    });

    res.status(201).json(new ApiResponse(201, customer));
});

// @desc    Get customer by ID with purchase history
// @route   GET /api/customers/:id
export const getCustomerById = asyncHandler(async (req: TenantRequest, res: Response) => {
    const customer = await Customer.findOne({ _id: req.params.id, storeId: req.tenantId });
    if (!customer) {
        return res.status(404).json(new ApiResponse(404, null, 'Customer not found'));
    }

    // Fetch recent orders associated with this customer
    const recentOrders = await Order.find({ customer: customer._id, storeId: req.tenantId })
        .sort('-createdAt')
        .limit(10);

    const totalSpend = await Order.aggregate([
        // $match in an aggregation pipeline does no Mongoose query casting — unlike
        // .find(), a raw string here silently matches nothing against the ObjectId
        // stored on Order.storeId, so this must be cast explicitly.
        {
            $match: {
                customer: customer._id,
                storeId: new mongoose.Types.ObjectId(req.tenantId as string),
                status: 'Completed',
            },
        },
        { $group: { _id: null, total: { $sum: '$grandTotal' } } },
    ]);

    const activityLog = await AuditLog.find({ storeId: req.tenantId, entity: 'Customer', entityId: customer._id })
        .populate('userId', 'name')
        .sort({ createdAt: -1 })
        .limit(20);

    const due = await CustomerDue.findOne({ customer: customer._id, storeId: req.tenantId });
    const dueHistory = due ? due.transactions.slice(-20).reverse() : [];

    res.status(200).json(
        new ApiResponse(200, {
            ...customer.toObject(),
            recentOrders,
            totalSpend: totalSpend[0]?.total || 0,
            activityLog,
            dueHistory,
        })
    );
});

// @desc    Update customer details (notes, tags, segment, etc.)
// @route   PUT /api/customers/:id
export const updateCustomer = asyncHandler(async (req: TenantRequest, res: Response) => {
    const customer = await Customer.findOneAndUpdate(
        { _id: req.params.id, storeId: req.tenantId },
        { $set: req.body },
        { returnDocument: 'after', runValidators: true }
    );

    if (!customer) {
        return res.status(404).json(new ApiResponse(404, null, 'Customer not found'));
    }

    await AuditLog.create({
        userId: req.user?._id,
        storeId: req.tenantId,
        action: 'UPDATED_CUSTOMER',
        entity: 'Customer',
        entityId: customer._id,
        details: `Updated customer ${customer.name}`,
    });

    res.status(200).json(new ApiResponse(200, customer, 'Customer updated successfully'));
});

// @desc    Delete a customer
// @route   DELETE /api/customers/:id
export const deleteCustomer = asyncHandler(async (req: TenantRequest, res: Response) => {
    const customer = await Customer.findOneAndDelete({ _id: req.params.id, storeId: req.tenantId });
    if (!customer) {
        return res.status(404).json(new ApiResponse(404, null, 'Customer not found'));
    }

    await AuditLog.create({
        userId: req.user?._id,
        storeId: req.tenantId,
        action: 'DELETED_CUSTOMER',
        entity: 'Customer',
        entityId: customer._id,
        details: `Deleted customer ${customer.name}`,
    });

    res.status(200).json(new ApiResponse(200, null, 'Customer deleted successfully'));
});

// @desc    Update customer wallet balance — routes through the real Wallet ledger
//          (matches the pattern already used by checkout/refunds) instead of writing
//          only to the legacy Customer.walletBalance mirror field.
// @route   POST /api/customers/:id/wallet
export const updateWalletBalance = asyncHandler(async (req: TenantRequest, res: Response) => {
    const { amount, action, reason } = req.body; // action: 'add' or 'deduct'

    if (!amount || amount <= 0) {
        return res.status(400).json(new ApiResponse(400, null, 'Invalid amount'));
    }
    if (action !== 'add' && action !== 'deduct') {
        return res.status(400).json(new ApiResponse(400, null, "action must be 'add' or 'deduct'"));
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    let customer;
    try {
        customer = await Customer.findOne({ _id: req.params.id, storeId: req.tenantId }).session(session);
        if (!customer) {
            await session.abortTransaction();
            return res.status(404).json(new ApiResponse(404, null, 'Customer not found'));
        }

        if (action === 'deduct' && customer.walletBalance < amount) {
            await session.abortTransaction();
            return res.status(400).json(new ApiResponse(400, null, 'Insufficient wallet balance'));
        }

        const delta = action === 'add' ? amount : -amount;
        const newBalance = customer.walletBalance + delta;

        customer.walletBalance = newBalance;
        await customer.save({ session });

        await Wallet.findOneAndUpdate(
            { customer: customer._id, storeId: req.tenantId },
            {
                $inc: { balance: delta },
                $push: {
                    transactions: {
                        type: action === 'add' ? 'CREDIT' : 'DEBIT',
                        amount,
                        reason: reason || `Manual ${action} by ${req.user?.name || 'Staff'}`,
                        date: new Date(),
                    },
                },
            },
            { session, upsert: true }
        );

        await AuditLog.create(
            [
                {
                    userId: req.user?._id,
                    storeId: req.tenantId,
                    action: action === 'add' ? 'WALLET_TOPUP' : 'WALLET_DEDUCT',
                    entity: 'Customer',
                    entityId: customer._id,
                    details: `${action === 'add' ? 'Added' : 'Deducted'} ${amount} to wallet${reason ? ` — ${reason}` : ''}. New balance: ${newBalance}`,
                },
            ],
            { session }
        );

        await session.commitTransaction();
    } catch (err) {
        await session.abortTransaction();
        throw err;
    } finally {
        session.endSession();
    }

    res.status(200).json(
        new ApiResponse(200, customer, `Wallet ${action}ed successfully. New Balance: ${customer.walletBalance}`)
    );
});

// @desc    Record a payment against a customer's outstanding dues (from a partial/
//          unpaid order) — mirrors updateWalletBalance's transactional pattern.
// @route   POST /api/customers/:id/dues/payment
export const recordDuePayment = asyncHandler(async (req: TenantRequest, res: Response) => {
    const { amount, method, reference, reason } = req.body;

    if (!amount || amount <= 0) {
        return res.status(400).json(new ApiResponse(400, null, 'Invalid amount'));
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    let customer;
    try {
        customer = await Customer.findOne({ _id: req.params.id, storeId: req.tenantId }).session(session);
        if (!customer) {
            await session.abortTransaction();
            return res.status(404).json(new ApiResponse(404, null, 'Customer not found'));
        }

        if (amount > customer.dueBalance) {
            await session.abortTransaction();
            return res.status(400).json(new ApiResponse(400, null, 'Payment exceeds outstanding balance'));
        }

        const newBalance = customer.dueBalance - amount;
        customer.dueBalance = newBalance;
        await customer.save({ session });

        await CustomerDue.findOneAndUpdate(
            { customer: customer._id, storeId: req.tenantId },
            {
                $inc: { balance: -amount },
                $push: {
                    transactions: {
                        type: 'PAYMENT',
                        amount,
                        reason:
                            reason || `Payment received via ${method || 'Cash'}${reference ? ` (${reference})` : ''}`,
                        date: new Date(),
                    },
                },
            },
            { session, upsert: true }
        );

        await AuditLog.create(
            [
                {
                    userId: req.user?._id,
                    storeId: req.tenantId,
                    action: 'DUE_PAYMENT_RECEIVED',
                    entity: 'Customer',
                    entityId: customer._id,
                    details: `Recorded payment of ${amount} against dues. New balance: ${newBalance}`,
                },
            ],
            { session }
        );

        await session.commitTransaction();
    } catch (err) {
        await session.abortTransaction();
        throw err;
    } finally {
        session.endSession();
    }

    res.status(200).json(
        new ApiResponse(200, customer, `Payment recorded successfully. New Balance Due: ${customer.dueBalance}`)
    );
});

// @desc    List customers with an outstanding due balance (accounts receivable)
// @route   GET /api/customers/dues
export const getCustomersWithDues = asyncHandler(async (req: TenantRequest, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    const search = (req.query.search as string)?.trim();
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    const query: any = { storeId: req.tenantId, dueBalance: { $gt: 0 } };
    if (search) {
        query.$or = [{ name: { $regex: search, $options: 'i' } }, { phone: { $regex: search, $options: 'i' } }];
    }
    if (startDate && endDate) {
        query.updatedAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const customers = await Customer.find(query).sort({ dueBalance: -1 }).skip(skip).limit(limit).lean();
    const total = await Customer.countDocuments(query);
    const totalOutstanding = await Customer.aggregate([
        { $match: { storeId: new mongoose.Types.ObjectId(req.tenantId as string), dueBalance: { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: '$dueBalance' } } },
    ]);

    res.status(200).json(
        new ApiResponse(200, {
            customers,
            totalOutstanding: totalOutstanding[0]?.total || 0,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            },
        })
    );
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
        createdAt: { $gte: thirtyDaysAgo },
    });

    // Customers who bought more than once (Retention heuristic)
    // Same $match-doesn't-cast pitfall as getCustomerById's totalSpend above.
    const repeatBuyersAggr = await Order.aggregate([
        {
            $match: {
                storeId: new mongoose.Types.ObjectId(storeId as string),
                status: 'Completed',
                customer: { $exists: true, $ne: null },
            },
        },
        { $group: { _id: '$customer', purchaseCount: { $sum: 1 } } },
        { $match: { purchaseCount: { $gt: 1 } } },
        { $count: 'repeatBuyers' },
    ]);
    const repeatBuyersCount = repeatBuyersAggr[0]?.repeatBuyers || 0;

    const retentionRate = totalCustomers > 0 ? ((repeatBuyersCount / totalCustomers) * 100).toFixed(1) : 0;

    res.status(200).json(
        new ApiResponse(200, {
            totalCustomers,
            newCustomers,
            repeatBuyersCount,
            retentionRate,
        })
    );
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
        { header: 'Notes', key: 'notes', width: 30 },
    ];

    customers.forEach((customer) => {
        worksheet.addRow({
            name: customer.name,
            phone: customer.phone,
            email: customer.email || '',
            segment: customer.segment,
            loyaltyPoints: customer.loyaltyPoints,
            walletBalance: customer.walletBalance,
            notes: customer.notes || '',
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
        return res.status(400).json(new ApiResponse(400, null, 'Please upload an Excel file'));
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer as any);
    const worksheet = workbook.worksheets[0];

    const customersToInsert: any[] = [];
    const storeId = req.tenantId;

    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
            // Skip Header
            const phone = row.getCell(2).value?.toString() || '';
            if (phone) {
                customersToInsert.push({
                    name: row.getCell(1).value?.toString() || 'Unknown',
                    phone: phone,
                    email: row.getCell(3).value?.toString() || undefined,
                    segment: row.getCell(4).value?.toString() || 'Retail',
                    notes: row.getCell(7).value?.toString() || '',
                    storeId,
                });
            }
        }
    });

    if (customersToInsert.length === 0) {
        return res.status(400).json(new ApiResponse(400, null, 'No valid data found in file'));
    }

    // Upsert logic (Match by phone + storeId)
    const bulkOps = customersToInsert.map((cust) => ({
        updateOne: {
            filter: { phone: cust.phone, storeId: cust.storeId },
            update: { $set: cust },
            upsert: true,
        },
    }));

    await Customer.bulkWrite(bulkOps);

    res.status(200).json(
        new ApiResponse(200, { imported: customersToInsert.length }, 'Customers imported successfully')
    );
});
