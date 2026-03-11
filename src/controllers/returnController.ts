import { Response } from 'express';
import ReturnOrder from '../models/ReturnOrder.js';
import Order from '../models/Order.js';
import Inventory from '../models/Inventory.js';
import PaymentTransaction from '../models/PaymentTransaction.js';
import mongoose from 'mongoose';
import { TenantRequest } from '../middleware/tenantHandler.js';

export const returnController = {
    createReturn: async (req: TenantRequest, res: Response) => {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            const { originalOrderId, items, refundAmount, refundMethod, notes } = req.body;
            const storeId = req.tenantId;

            // 1. Fetch original order
            const originalOrder = await Order.findById(originalOrderId);
            if (!originalOrder) throw new Error("Original order not found");

            // 2. Generate Return Number
            const returnNumber = `RET-${Date.now()}`;

            // 3. Create Return Order
            const returnOrder = new ReturnOrder({
                returnNumber,
                originalOrder: originalOrderId,
                storeId,
                customer: originalOrder.customer,
                items,
                subTotal: items.reduce((acc: number, item: any) => acc + (item.price * item.quantity), 0),
                taxTotal: items.reduce((acc: number, item: any) => acc + (item.tax * item.quantity), 0),
                grandTotal: items.reduce((acc: number, item: any) => acc + ((item.price + item.tax) * item.quantity), 0),
                refundAmount,
                status: 'Received',
                receivedBy: req.user?._id,
                notes
            });

            await returnOrder.save({ session });

            // 4. Update Inventory (Restock)
            for (const item of items) {
                await Inventory.findOneAndUpdate(
                    { product: item.product, variant: item.variant, store: storeId },
                    { $inc: { quantity: item.quantity } },
                    { session, upsert: true }
                );
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
                    performedBy: req.user?._id
                });
                await refund.save({ session });
                returnOrder.refundStatus = 'Processed';
                await returnOrder.save({ session });
            }

            await session.commitTransaction();
            res.status(201).json({ success: true, data: returnOrder });
        } catch (error: any) {
            await session.abortTransaction();
            res.status(500).json({ success: false, message: error.message });
        } finally {
            session.endSession();
        }
    },

    getReturns: async (req: TenantRequest, res: Response) => {
        try {
            const returns = await ReturnOrder.find({ storeId: req.tenantId })
                .populate('originalOrder')
                .populate('customer')
                .sort({ createdAt: -1 });
            res.json({ success: true, data: returns });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
};
