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

// ... (wait, targeting specific chunk)

import Wallet from '../models/Wallet.js';

// @desc    Create a new POS order
// @route   POST /api/orders
// @access  Private (Cashier/Manager/Owner)
export const createOrder = asyncHandler(async (req: TenantRequest, res: Response) => {
    const { customerId, items, subTotal, taxTotal, discountTotal, grandTotal, paymentDetails, loyaltyPointsUsed } = req.body;

    const orderNumber = `ORD-${Date.now()}`;

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

            // Send Automated Notifications
            if (customer.email) {
                sendEmail({
                    to: customer.email,
                    subject: `Receipt for Order ${orderNumber}`,
                    html: `<h2>Thank you for your purchase!</h2>
                           <p>Order Number: <strong>${orderNumber}</strong></p>
                           <p>Total Paid: <strong>${grandTotal}</strong></p>
                           <p>We hope to see you again soon.</p>`
                }).catch(console.log); // Fire and forget
            }
            if (customer.phone) {
                sendSMS({
                    to: customer.phone,
                    body: `RetailSync: Thanks for your purchase! Order ${orderNumber} total is ${grandTotal}.`
                }).catch(console.log);
            }
        }
    }

    // Reduce inventory for each item
    for (const item of items) {
        const inv = await Inventory.findOneAndUpdate(
            { product: item.product, store: req.tenantId },
            { $inc: { quantity: -item.quantity } },
            { new: true }
        );

        // Notify clients about stock change
        emitToStore(req.tenantId!.toString(), 'inventory-update', {
            productId: item.product,
            newQuantity: inv?.quantity
        });
    }

    res.status(201).json(new ApiResponse(201, order, "Order created successfully"));
});

// @desc    Get all orders for a store
// @route   GET /api/orders
// @access  Private
export const getOrders = asyncHandler(async (req: TenantRequest, res: Response) => {
    const orders = await Order.find({ storeId: req.tenantId })
        .populate('customer')
        .populate('cashier', 'name')
        .sort({ createdAt: -1 });

    res.status(200).json(new ApiResponse(200, orders));
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
