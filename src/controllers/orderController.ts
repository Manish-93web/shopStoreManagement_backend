import { Response } from 'express';
import Order from '../models/Order.js';
import Inventory from '../models/Inventory.js';
import Product from '../models/Product.js';
import Customer from '../models/Customer.js';
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
import redisClient from '../config/redis.js';

// @desc    Create a new POS order
// @route   POST /api/orders
// @access  Private (Cashier/Manager/Owner)
export const createOrder = asyncHandler(async (req: TenantRequest, res: Response) => {
    const { customerId, items, subTotal, taxTotal, discountTotal, grandTotal, paymentDetails, loyaltyPointsUsed, couponCode } = req.body;

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
            return res.status(400).json(new ApiResponse(400, null, "Insufficient wallet balance"));
        }
        wallet.balance -= walletPayment.amount;
        wallet.transactions.push({
            type: 'DEBIT',
            amount: walletPayment.amount,
            reason: `Order ${orderNumber}`,
            date: new Date()
        });
        await wallet.save();
    }

    const order = await Order.create({
        orderNumber,
        storeId: req.tenantId,
        customer: customerId,
        items,
        subTotal,
        taxTotal,
        discountTotal,
        grandTotal,
        paymentDetails,
        loyaltyPointsUsed,
        cashier: req.user._id,
        paymentStatus: paymentDetails.reduce((acc: number, p: any) => acc + p.amount, 0) >= grandTotal ? 'Paid' : 'Partial'
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
        notes: `Payment for Order ${orderNumber}`
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
                return res.status(400).json(new ApiResponse(400, null, "Insufficient loyalty points"));
            }
            loyalty.points -= loyaltyPointsUsed;
            loyalty.totalRedeemed += loyaltyPointsUsed;
        }

        // Add points based on Tier multipliers
        // Silver: 1x, Gold: 1.5x, Platinum: 2x
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
            customer.loyaltyPoints += (earnedPoints - (loyaltyPointsUsed || 0));
            await customer.save();

            // Send Automated Notifications via Central Service
            await notificationService.send({
                recipientId: customer._id.toString(),
                storeId: req.tenantId!.toString(),
                title: `Order Confirmed: ${orderNumber}`,
                message: `Thank you for your purchase of ₹${grandTotal}. Your order has been successfully placed.`,
                type: 'SUCCESS',
                metadata: { orderId: order._id }
            });
        }
    }

    // 3. Notify Store Owner about New Order
    const store = await Store.findById(req.tenantId);
    if (store) {
        await notificationService.send({
            recipientId: store.owner.toString(),
            storeId: req.tenantId!.toString(),
            title: `New Sale: ${orderNumber}`,
            message: `A new sale of ₹${grandTotal} has been recorded by ${req.user.name}.`,
            type: 'INFO',
            metadata: { orderId: order._id }
        });
    }

    // Reduce inventory for each item
    for (const item of items) {
        const inv = await Inventory.findOneAndUpdate(
            { product: item.product, store: req.tenantId },
            { $inc: { quantity: -item.quantity } },
            { returnDocument: 'after' }
        );

        // Notify clients about stock change
        emitToStore(req.tenantId!.toString(), 'inventory-update', {
            productId: item.product,
            newQuantity: inv?.quantity
        });
    }

    // 4. Trigger Webhooks
    webhookService.trigger('order.created', req.tenantId!.toString(), order);

    res.status(201).json(new ApiResponse(201, order, "Order created successfully"));
});

// @desc    Get all orders for a store
// @route   GET /api/orders
// @access  Private
export const getOrders = asyncHandler(async (req: TenantRequest, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const cacheKey = `orders:${req.tenantId}:p${page}:l${limit}`;
    if (process.env.SKIP_REDIS !== 'true') {
        const cached = await redisClient.get(cacheKey);
        if (cached) return res.status(200).json(new ApiResponse(200, JSON.parse(cached), "Orders from cache"));
    }

    const orders = await Order.find({ storeId: req.tenantId })
        .populate('customer')
        .populate('cashier', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

    const total = await Order.countDocuments({ storeId: req.tenantId });

    const response = {
        orders,
        pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit)
        }
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
        return res.status(404).json(new ApiResponse(404, null, "Order not found"));
    }

    res.status(200).json(new ApiResponse(200, order));
});
