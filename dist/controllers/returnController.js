import ReturnOrder from '../models/ReturnOrder.js';
import Order from '../models/Order.js';
import Inventory from '../models/Inventory.js';
import PaymentTransaction from '../models/PaymentTransaction.js';
import Wallet from '../models/Wallet.js';
import Customer from '../models/Customer.js';
import mongoose from 'mongoose';
import { bumpCacheVersion } from '../config/redis.js';
import { emitToStore } from '../config/socket.js';
export const returnController = {
    createReturn: async (req, res) => {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            const { originalOrderId, items, refundAmount, refundMethod, notes } = req.body;
            const storeId = req.tenantId;
            // 1. Fetch original order
            const originalOrder = await Order.findById(originalOrderId);
            if (!originalOrder)
                throw new Error('Original order not found');
            // 2. Generate Return Number
            const returnNumber = `RET-${Date.now()}`;
            // 3. Create Return Order
            const returnOrder = new ReturnOrder({
                returnNumber,
                originalOrder: originalOrderId,
                storeId,
                customer: originalOrder.customer,
                items,
                subTotal: items.reduce((acc, item) => acc + item.price * item.quantity, 0),
                taxTotal: items.reduce((acc, item) => acc + item.tax * item.quantity, 0),
                grandTotal: items.reduce((acc, item) => acc + (item.price + item.tax) * item.quantity, 0),
                refundAmount,
                status: 'Received',
                receivedBy: req.user?._id,
                notes,
            });
            await returnOrder.save({ session });
            // 4. Update Inventory (Restock)
            for (const item of items) {
                await Inventory.findOneAndUpdate({ product: item.product, variant: item.variant, store: storeId }, { $inc: { quantity: item.quantity } }, { session, upsert: true });
            }
            // 5. Create Refund Transaction (If method provided)
            if (refundAmount > 0) {
                const refund = new PaymentTransaction({
                    transactionNumber: `REF-${Date.now()}`,
                    originalOrder: originalOrderId,
                    returnOrderId: returnOrder._id,
                    storeId,
                    type: 'Outflow',
                    category: 'Refund',
                    amount: refundAmount,
                    method: refundMethod || 'Cash',
                    status: 'Completed',
                    performedBy: req.user?._id,
                });
                await refund.save({ session });
                // Update Wallet if applicable
                if (refundMethod === 'Wallet' && originalOrder.customer) {
                    await Wallet.findOneAndUpdate({ customer: originalOrder.customer, storeId }, {
                        $inc: { balance: refundAmount },
                        $push: {
                            transactions: {
                                type: 'CREDIT',
                                amount: refundAmount,
                                reason: `Refund for ${originalOrder.orderNumber}`,
                                date: new Date(),
                            },
                        },
                    }, { session, upsert: true });
                    // Update legacy loyalty field if needed (often used for simple balance display)
                    await Customer.findByIdAndUpdate(originalOrder.customer, { $inc: { walletBalance: refundAmount } }, { session });
                }
                returnOrder.refundStatus = 'Processed';
                await returnOrder.save({ session });
            }
            await session.commitTransaction();
            await bumpCacheVersion(storeId.toString());
            for (const item of items) {
                const inv = await Inventory.findOne({ product: item.product, variant: item.variant, store: storeId });
                emitToStore(storeId.toString(), 'inventory-update', {
                    productId: item.product,
                    variantId: item.variant,
                    newQuantity: inv?.quantity,
                });
            }
            res.status(201).json({ success: true, data: returnOrder });
        }
        catch (error) {
            await session.abortTransaction();
            res.status(500).json({ success: false, message: error.message });
        }
        finally {
            session.endSession();
        }
    },
    getReturns: async (req, res) => {
        try {
            const returns = await ReturnOrder.find({ storeId: req.tenantId })
                .populate('originalOrder')
                .populate('customer')
                .sort({ createdAt: -1 });
            res.json({ success: true, data: returns });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    },
};
