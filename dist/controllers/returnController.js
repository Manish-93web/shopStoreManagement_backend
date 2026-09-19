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
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const skip = (page - 1) * limit;
            const search = req.query.search?.trim();
            const status = req.query.status?.trim();
            const startDate = req.query.startDate;
            const endDate = req.query.endDate;
            const query = { storeId: req.tenantId };
            if (search) {
                // Matches either the return number directly, or the original order's
                // order number — a staffer is as likely to recall the sale as the RMA #.
                const matchingOrders = await Order.find({
                    storeId: req.tenantId,
                    orderNumber: { $regex: search, $options: 'i' },
                }).select('_id');
                query.$or = [
                    { returnNumber: { $regex: search, $options: 'i' } },
                    ...(matchingOrders.length ? [{ originalOrder: { $in: matchingOrders.map((o) => o._id) } }] : []),
                ];
            }
            if (status)
                query.status = status;
            if (startDate && endDate) {
                query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
            }
            const [returns, total, statsAgg] = await Promise.all([
                ReturnOrder.find(query)
                    .populate('originalOrder')
                    .populate('customer')
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit),
                ReturnOrder.countDocuments(query),
                // Quick-stat cards summarize the whole store, independent of the
                // current search/status/date filters or pagination window.
                ReturnOrder.aggregate([
                    { $match: { storeId: new mongoose.Types.ObjectId(req.tenantId) } },
                    {
                        $group: {
                            _id: null,
                            totalReturns: { $sum: 1 },
                            pendingInspection: { $sum: { $cond: [{ $eq: ['$status', 'Received'] }, 1, 0] } },
                            completed: { $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] } },
                            totalRefunded: { $sum: { $ifNull: ['$refundAmount', 0] } },
                        },
                    },
                ]),
            ]);
            const stats = statsAgg[0] || { totalReturns: 0, pendingInspection: 0, completed: 0, totalRefunded: 0 };
            res.json({
                success: true,
                data: {
                    returns,
                    pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 },
                    stats,
                },
            });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    },
};
