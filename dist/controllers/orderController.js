import Order from '../models/Order.js';
import Inventory from '../models/Inventory.js';
import Customer from '../models/Customer.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/apiResponse.js';
import { emitToStore } from '../config/socket.js';
import Loyalty from '../models/Loyalty.js';
import Wallet from '../models/Wallet.js';
// @desc    Create a new POS order
// @route   POST /api/orders
// @access  Private (Cashier/Manager/Owner)
export const createOrder = asyncHandler(async (req, res) => {
    const { customerId, items, subTotal, taxTotal, discountTotal, grandTotal, paymentDetails, loyaltyPointsUsed } = req.body;
    const orderNumber = `ORD-${Date.now()}`;
    // 1. Process Wallet usage if any
    const walletPayment = paymentDetails.find((p) => p.method === 'Wallet');
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
        paymentStatus: paymentDetails.reduce((acc, p) => acc + p.amount, 0) >= grandTotal ? 'Paid' : 'Partial'
    });
    // 2. Handle Customer Loyalty
    if (customerId) {
        let loyalty = await Loyalty.findOne({ customer: customerId, storeId: req.tenantId });
        if (!loyalty) {
            loyalty = new Loyalty({ customer: customerId, storeId: req.tenantId });
        }
        // Deduct points if used
        if (loyaltyPointsUsed) {
            loyalty.points -= loyaltyPointsUsed;
            loyalty.totalRedeemed += loyaltyPointsUsed;
        }
        // Add points for new purchase (1 point per 100 spent)
        const earnedPoints = Math.floor(grandTotal / 100);
        loyalty.points += earnedPoints;
        loyalty.totalEarned += earnedPoints;
        loyalty.lastUpdated = new Date();
        await loyalty.save();
        // Also update legacy field in Customer for compatibility
        await Customer.findByIdAndUpdate(customerId, { $inc: { loyaltyPoints: earnedPoints - (loyaltyPointsUsed || 0) } });
    }
    // Reduce inventory for each item
    for (const item of items) {
        const inv = await Inventory.findOneAndUpdate({ product: item.product, store: req.tenantId }, { $inc: { quantity: -item.quantity } }, { new: true });
        // Notify clients about stock change
        emitToStore(req.tenantId.toString(), 'inventory-update', {
            productId: item.product,
            newQuantity: inv?.quantity
        });
    }
    res.status(201).json(new ApiResponse(201, order, "Order created successfully"));
});
// @desc    Get all orders for a store
// @route   GET /api/orders
// @access  Private
export const getOrders = asyncHandler(async (req, res) => {
    const orders = await Order.find({ storeId: req.tenantId })
        .populate('customer')
        .populate('cashier', 'name')
        .sort({ createdAt: -1 });
    res.status(200).json(new ApiResponse(200, orders));
});
// @desc    Get single order details
// @route   GET /api/orders/:id
// @access  Private
export const getOrderById = asyncHandler(async (req, res) => {
    const order = await Order.findOne({ _id: req.params.id, storeId: req.tenantId })
        .populate('customer')
        .populate('items.product')
        .populate('cashier', 'name');
    if (!order) {
        return res.status(404).json(new ApiResponse(404, null, "Order not found"));
    }
    res.status(200).json(new ApiResponse(200, order));
});
