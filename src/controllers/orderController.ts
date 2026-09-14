import { Response } from 'express';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Inventory from '../models/Inventory.js';
import Product from '../models/Product.js';
import Customer from '../models/Customer.js';
import AuditLog from '../models/AuditLog.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/apiResponse.js';
import { TenantRequest } from '../middleware/tenantHandler.js';
import { emitToStore } from '../config/socket.js';
import { sendEmail } from '../utils/emailService.js';
import { sendSMS } from '../utils/smsService.js';
import PaymentTransaction from '../models/PaymentTransaction.js';
import { notificationService } from '../services/notificationService.js';
import Store from '../models/Store.js';
import Wallet from '../models/Wallet.js';
import webhookService from '../services/webhookService.js';
import Coupon from '../models/Coupon.js';
import Loyalty from '../models/Loyalty.js';
import redisClient, { bumpCacheVersion, getCacheVersion } from '../config/redis.js';

// @desc    Create a new POS order
// @route   POST /api/orders
// @access  Private (Cashier/Manager/Owner)
export const createOrder = asyncHandler(async (req: TenantRequest, res: Response) => {
    const {
        customerId,
        items,
        subTotal,
        taxTotal,
        discountTotal,
        discountReason,
        grandTotal,
        paymentDetails,
        loyaltyPointsUsed,
        couponCode,
        isGstBill = true,
    } = req.body;

    const orderNumber = `ORD-${Date.now()}`;

    // 0. Increment Coupon usage if applicable
    if (couponCode) {
        await Coupon.findOneAndUpdate(
            { code: couponCode.toUpperCase(), storeId: req.tenantId },
            { $inc: { usageCount: 1 } }
        );
    }

    // 1. Process Wallet usage if any
    const walletPayment = paymentDetails.find((p: any) => p.method === 'Wallet');
    if (walletPayment && customerId) {
        const wallet = await Wallet.findOne({ customer: customerId, storeId: req.tenantId });
        if (!wallet || wallet.balance < walletPayment.amount) {
            return res.status(400).json(new ApiResponse(400, null, 'Insufficient wallet balance'));
        }
        wallet.balance -= walletPayment.amount;
        wallet.transactions.push({
            type: 'DEBIT',
            amount: walletPayment.amount,
            reason: `Order ${orderNumber}`,
            date: new Date(),
        });
        await wallet.save();
    }

    // GST split: CGST+SGST for intra-state sales, IGST for inter-state.
    // Defaults to intra-state when the store has no state on file, or there's no
    // customer / the customer has no state on file (the common walk-in POS case).
    const gstStore = await Store.findById(req.tenantId);
    let gstCustomerState: string | undefined;
    if (customerId) {
        const gstCustomer = await Customer.findById(customerId).select('state');
        gstCustomerState = gstCustomer?.state;
    }
    const isInterState = !!(gstStore?.state && gstCustomerState && gstStore.state !== gstCustomerState);
    const taxType: 'Intra-State' | 'Inter-State' = isInterState ? 'Inter-State' : 'Intra-State';

    // A non-GST bill charges no tax at all, regardless of what the client sent —
    // enforced here too, not just trusted from the POS payload.
    const itemsWithGstSplit = items.map((item: any) => {
        const itemTax = isGstBill ? item.tax || 0 : 0;
        return {
            ...item,
            tax: itemTax,
            cgst: isInterState ? 0 : itemTax / 2,
            sgst: isInterState ? 0 : itemTax / 2,
            igst: isInterState ? itemTax : 0,
        };
    });

    const order = await Order.create({
        orderNumber,
        storeId: req.tenantId,
        customer: customerId,
        items: itemsWithGstSplit,
        subTotal,
        taxTotal: isGstBill ? taxTotal : 0,
        taxType,
        isGstBill,
        discountTotal,
        discountReason,
        grandTotal,
        paymentDetails,
        loyaltyPointsUsed,
        cashier: req.user._id,
        paymentStatus:
            paymentDetails.reduce((acc: number, p: any) => acc + p.amount, 0) >= grandTotal ? 'Paid' : 'Partial',
    });

    // Write accurate PaymentTransactions for Audit Tracing
    const paymentOps = paymentDetails.map((paymentRaw: any) => ({
        transactionNumber: `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        storeId: req.tenantId,
        orderId: order._id,
        type: 'Inflow',
        category: 'Sale',
        method: paymentRaw.method,
        amount: paymentRaw.amount,
        status: 'Completed',
        performedBy: req.user._id,
        notes: `Payment for Order ${orderNumber}`,
    }));
    await PaymentTransaction.insertMany(paymentOps);

    // 2. Handle Customer Loyalty
    if (customerId) {
        let loyalty = await Loyalty.findOne({ customer: customerId, storeId: req.tenantId });
        if (!loyalty) {
            loyalty = new Loyalty({ customer: customerId, storeId: req.tenantId });
        }

        // Deduct points if used
        if (loyaltyPointsUsed) {
            if (loyalty.points < loyaltyPointsUsed) {
                return res.status(400).json(new ApiResponse(400, null, 'Insufficient loyalty points'));
            }
            loyalty.points -= loyaltyPointsUsed;
            loyalty.totalRedeemed += loyaltyPointsUsed;
        }

        // points based on 1% base rate (Example: 1000₹ = 10 points)
        // plus Tier multipliers - Silver: 1x, Gold: 1.5x, Platinum: 2x
        let multiplier = 1;
        if (loyalty.tier === 'Gold') multiplier = 1.5;
        if (loyalty.tier === 'Platinum') multiplier = 2;

        const earnedPoints = Math.floor((grandTotal / 100) * multiplier);
        loyalty.points += earnedPoints;
        loyalty.totalEarned += earnedPoints;
        loyalty.lifetimeSpent += grandTotal;
        loyalty.lastUpdated = new Date();

        // Auto-upgrade Tiers
        if (loyalty.lifetimeSpent >= 200000) {
            loyalty.tier = 'Platinum';
        } else if (loyalty.lifetimeSpent >= 50000) {
            loyalty.tier = 'Gold';
        }

        await loyalty.save();

        // Also update legacy field in Customer for compatibility and trigger notifications
        const customer = await Customer.findById(customerId);
        if (customer) {
            customer.loyaltyPoints += earnedPoints - (loyaltyPointsUsed || 0);
            await customer.save();

            // Send Automated Notifications via Central Service
            await notificationService.send({
                recipientId: customer._id.toString(),
                storeId: req.tenantId!.toString(),
                title: `Order Confirmed: ${orderNumber}`,
                message: `Thank you for your purchase of ₹${grandTotal}. Your order has been successfully placed.`,
                type: 'SUCCESS',
                metadata: { orderId: order._id },
            });
        }
    }

    // 3. Notify Store Owner about New Order
    const store = gstStore;
    if (store) {
        await notificationService.send({
            recipientId: store.owner.toString(),
            storeId: req.tenantId!.toString(),
            title: `New Sale: ${orderNumber}`,
            message: `A new sale of ₹${grandTotal} has been recorded by ${req.user.name}.`,
            type: 'INFO',
            metadata: { orderId: order._id },
        });
    }

    // Reduce inventory for each item
    for (const item of items) {
        const invQuery: any = { store: req.tenantId };
        if (item.variant) {
            invQuery.variant = item.variant;
        } else {
            invQuery.product = item.product;
            invQuery.variant = { $exists: false }; // Base product stock if no variant
        }

        const inv = await Inventory.findOneAndUpdate(
            invQuery,
            { $inc: { quantity: -item.quantity } },
            { returnDocument: 'after' }
        );

        // Notify clients about stock change
        emitToStore(req.tenantId!.toString(), 'inventory-update', {
            productId: item.product,
            variantId: item.variant,
            newQuantity: inv?.quantity,
        });
    }
    await bumpCacheVersion(req.tenantId!.toString());
    await bumpCacheVersion(req.tenantId!.toString(), 'orders');

    // 4. Trigger Webhooks
    webhookService.trigger('order.created', req.tenantId!.toString(), order);

    res.status(201).json(new ApiResponse(201, order, 'Order created successfully'));
});

// @desc    Get all orders for a store
// @route   GET /api/orders
// @access  Private
export const getOrders = asyncHandler(async (req: TenantRequest, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    const search = (req.query.search as string)?.trim();

    const ordersCacheVersion = await getCacheVersion(req.tenantId!.toString(), 'orders');
    const cacheKey = `orders:${req.tenantId}:v${ordersCacheVersion}:p${page}:l${limit}:s${search || ''}`;
    if (process.env.SKIP_REDIS !== 'true') {
        const cached = await redisClient.get(cacheKey);
        if (cached) return res.status(200).json(new ApiResponse(200, JSON.parse(cached), 'Orders from cache'));
    }

    const query: any = { storeId: req.tenantId };
    if (search) {
        query.orderNumber = { $regex: search, $options: 'i' };
    }

    const orders = await Order.find(query)
        .populate('customer')
        .populate('cashier', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

    const total = await Order.countDocuments(query);

    const response = {
        orders,
        pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
        },
    };

    if (process.env.SKIP_REDIS !== 'true') {
        await redisClient.setEx(cacheKey, 300, JSON.stringify(response)); // 5 min cache
    }

    res.status(200).json(new ApiResponse(200, response));
});

// @desc    Get single order details
// @route   GET /api/orders/:id
// @access  Private
export const getOrderById = asyncHandler(async (req: TenantRequest, res: Response) => {
    const order = await Order.findOne({ _id: req.params.id, storeId: req.tenantId })
        .populate('customer')
        .populate('items.product')
        .populate('cashier', 'name');

    if (!order) {
        return res.status(404).json(new ApiResponse(404, null, 'Order not found'));
    }

    res.status(200).json(new ApiResponse(200, order));
});

// @desc    Cancel a completed order — reverses inventory, refunds any Wallet payment,
//          and returns redeemed loyalty points. Earned loyalty points are not clawed back.
// @route   PUT /api/orders/:id/cancel
// @access  Private (Cashier/Manager/Owner)
export const cancelOrder = asyncHandler(async (req: TenantRequest, res: Response) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    let order;
    try {
        order = await Order.findOne({ _id: req.params.id, storeId: req.tenantId }).session(session);
        if (!order) {
            await session.abortTransaction();
            return res.status(404).json(new ApiResponse(404, null, 'Order not found'));
        }
        if (order.status === 'Cancelled') {
            await session.abortTransaction();
            return res.status(400).json(new ApiResponse(400, null, 'Order is already cancelled'));
        }

        for (const item of order.items) {
            const invQuery: any = { store: req.tenantId };
            if (item.variant) {
                invQuery.variant = item.variant;
            } else {
                invQuery.product = item.product;
                invQuery.variant = { $exists: false };
            }
            await Inventory.findOneAndUpdate(
                invQuery,
                { $inc: { quantity: item.quantity } },
                { session, upsert: true }
            );
        }

        const walletPayment = order.paymentDetails.find((p) => p.method === 'Wallet');
        if (walletPayment && order.customer) {
            await Wallet.findOneAndUpdate(
                { customer: order.customer, storeId: req.tenantId },
                {
                    $inc: { balance: walletPayment.amount },
                    $push: {
                        transactions: {
                            type: 'CREDIT',
                            amount: walletPayment.amount,
                            reason: `Cancelled order ${order.orderNumber}`,
                            date: new Date(),
                        },
                    },
                },
                { session, upsert: true }
            );
            await Customer.findByIdAndUpdate(
                order.customer,
                { $inc: { walletBalance: walletPayment.amount } },
                { session }
            );
        }

        if (order.loyaltyPointsUsed && order.customer) {
            await Loyalty.findOneAndUpdate(
                { customer: order.customer, storeId: req.tenantId },
                { $inc: { points: order.loyaltyPointsUsed, totalRedeemed: -order.loyaltyPointsUsed } },
                { session, upsert: true }
            );
        }

        order.status = 'Cancelled';
        await order.save({ session });

        await AuditLog.create(
            [
                {
                    userId: req.user._id,
                    storeId: req.tenantId,
                    action: 'CANCELLED_ORDER',
                    entity: 'Order',
                    entityId: order._id,
                    details: `Cancelled order ${order.orderNumber}`,
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

    await bumpCacheVersion(req.tenantId!.toString());
    await bumpCacheVersion(req.tenantId!.toString(), 'orders');
    for (const item of order.items) {
        const inv = await Inventory.findOne(
            item.variant
                ? { variant: item.variant, store: req.tenantId }
                : { product: item.product, store: req.tenantId, variant: { $exists: false } }
        );
        emitToStore(req.tenantId!.toString(), 'inventory-update', {
            productId: item.product,
            variantId: item.variant,
            newQuantity: inv?.quantity,
        });
    }

    res.status(200).json(new ApiResponse(200, order, 'Order cancelled'));
});
