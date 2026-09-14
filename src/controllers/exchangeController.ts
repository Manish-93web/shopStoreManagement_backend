import { Response } from 'express';
import mongoose from 'mongoose';
import ExchangeOrder from '../models/ExchangeOrder.js';
import ReturnOrder from '../models/ReturnOrder.js';
import Order from '../models/Order.js';
import Inventory from '../models/Inventory.js';
import Wallet from '../models/Wallet.js';
import Customer from '../models/Customer.js';
import PaymentTransaction from '../models/PaymentTransaction.js';
import AuditLog from '../models/AuditLog.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/apiResponse.js';
import { TenantRequest } from '../middleware/tenantHandler.js';
import { bumpCacheVersion } from '../config/redis.js';
import { emitToStore } from '../config/socket.js';

const lineTotal = (item: { price: number; tax: number; quantity: number }) =>
    (item.price + (item.tax || 0)) * item.quantity;

// @desc    Process a return-for-new-item exchange in one atomic flow: restocks the
//          returned items, decrements stock for the new items, and settles the price
//          difference — the customer pays the shortfall via the chosen method, or the
//          excess return value is credited to their Wallet (requires a customer on file).
//          Returned and new items are paired 1:1 by array position.
// @route   POST /api/exchanges
// @access  Private (Cashier/Manager/Owner)
export const createExchange = asyncHandler(async (req: TenantRequest, res: Response) => {
    const { originalOrderId, customerId, returnedItems, newItems, paymentMethod, notes } = req.body;

    if (
        !Array.isArray(returnedItems) ||
        !Array.isArray(newItems) ||
        returnedItems.length === 0 ||
        returnedItems.length !== newItems.length
    ) {
        return res
            .status(400)
            .json(
                new ApiResponse(
                    400,
                    null,
                    'returnedItems and newItems must be non-empty arrays of equal length (paired 1:1)'
                )
            );
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const originalOrder = await Order.findOne({ _id: originalOrderId, storeId: req.tenantId }).session(session);
        if (!originalOrder) throw new Error('Original order not found');

        const returnedTotal = returnedItems.reduce((sum: number, i: any) => sum + lineTotal(i), 0);
        const newTotal = newItems.reduce((sum: number, i: any) => sum + lineTotal(i), 0);
        const diff = newTotal - returnedTotal; // positive: customer owes more; negative: store owes customer

        // 1. Return leg — restock returned items
        const returnNumber = `RET-${Date.now()}`;
        const [returnOrder] = await ReturnOrder.create(
            [
                {
                    returnNumber,
                    originalOrder: originalOrderId,
                    storeId: req.tenantId,
                    customer: customerId || originalOrder.customer,
                    items: returnedItems,
                    subTotal: returnedItems.reduce((sum: number, i: any) => sum + i.price * i.quantity, 0),
                    taxTotal: returnedItems.reduce((sum: number, i: any) => sum + (i.tax || 0) * i.quantity, 0),
                    grandTotal: returnedTotal,
                    refundAmount: returnedTotal,
                    refundStatus: 'Processed',
                    status: 'Completed',
                    receivedBy: req.user._id,
                    notes: notes || 'Applied as credit toward an exchange',
                },
            ],
            { session }
        );

        for (const item of returnedItems) {
            await Inventory.findOneAndUpdate(
                { product: item.product, variant: item.variant, store: req.tenantId },
                { $inc: { quantity: item.quantity } },
                { session, upsert: true }
            );
        }

        // 2. New-order leg — decrement stock for the new items
        const orderNumber = `ORD-${Date.now()}`;
        const paymentDetails: any[] = [{ method: 'Store Credit', amount: Math.min(returnedTotal, newTotal) }];
        if (diff > 0) {
            paymentDetails.push({ method: paymentMethod || 'Cash', amount: diff });
        }

        const [newOrder] = await Order.create(
            [
                {
                    orderNumber,
                    storeId: req.tenantId,
                    customer: customerId || originalOrder.customer,
                    items: newItems,
                    subTotal: newItems.reduce((sum: number, i: any) => sum + i.price * i.quantity, 0),
                    taxTotal: newItems.reduce((sum: number, i: any) => sum + (i.tax || 0) * i.quantity, 0),
                    taxType: originalOrder.taxType,
                    discountTotal: 0,
                    grandTotal: newTotal,
                    paymentDetails,
                    cashier: req.user._id,
                    paymentStatus: 'Paid',
                },
            ],
            { session }
        );

        for (const item of newItems) {
            const invQuery: any = { store: req.tenantId };
            if (item.variant) {
                invQuery.variant = item.variant;
            } else {
                invQuery.product = item.product;
                invQuery.variant = { $exists: false };
            }
            await Inventory.findOneAndUpdate(
                invQuery,
                { $inc: { quantity: -item.quantity } },
                { session, upsert: true }
            );
        }

        // 3. Excess return value (returnedTotal > newTotal) becomes Wallet credit
        const excess = returnedTotal - newTotal;
        if (excess > 0 && (customerId || originalOrder.customer)) {
            const custId = customerId || originalOrder.customer;
            await Wallet.findOneAndUpdate(
                { customer: custId, storeId: req.tenantId },
                {
                    $inc: { balance: excess },
                    $push: {
                        transactions: {
                            type: 'CREDIT',
                            amount: excess,
                            reason: `Exchange credit for ${returnNumber}`,
                            date: new Date(),
                        },
                    },
                },
                { session, upsert: true }
            );
            await Customer.findByIdAndUpdate(custId, { $inc: { walletBalance: excess } }, { session });
            await PaymentTransaction.create(
                [
                    {
                        transactionNumber: `REF-${Date.now()}`,
                        storeId: req.tenantId,
                        orderId: newOrder._id,
                        returnOrderId: returnOrder._id,
                        type: 'Outflow',
                        category: 'Refund',
                        method: 'Wallet',
                        amount: excess,
                        status: 'Completed',
                        performedBy: req.user._id,
                        notes: `Exchange credit balance for ${returnNumber}`,
                    },
                ],
                { session }
            );
        }

        if (diff > 0) {
            await PaymentTransaction.create(
                [
                    {
                        transactionNumber: `TXN-${Date.now()}`,
                        storeId: req.tenantId,
                        orderId: newOrder._id,
                        type: 'Inflow',
                        category: 'Sale',
                        method: paymentMethod || 'Cash',
                        amount: diff,
                        status: 'Completed',
                        performedBy: req.user._id,
                        notes: `Additional payment for exchange ${returnNumber}`,
                    },
                ],
                { session }
            );
        }

        // 4. Link everything together
        const exchangeNumber = `EXC-${Date.now()}`;
        const exchangedItems = returnedItems.map((ret: any, idx: number) => ({
            returnedProduct: ret.product,
            returnedVariant: ret.variant,
            newProduct: newItems[idx].product,
            newVariant: newItems[idx].variant,
            quantity: newItems[idx].quantity,
            priceDifference: lineTotal(newItems[idx]) - lineTotal(ret),
        }));

        const [exchangeOrder] = await ExchangeOrder.create(
            [
                {
                    exchangeNumber,
                    returnOrder: returnOrder._id,
                    originalOrder: originalOrderId,
                    newOrder: newOrder._id,
                    storeId: req.tenantId,
                    exchangedItems,
                    status: 'Completed',
                },
            ],
            { session }
        );

        await AuditLog.create(
            [
                {
                    userId: req.user._id,
                    storeId: req.tenantId,
                    action: 'CREATED_EXCHANGE',
                    entity: 'ExchangeOrder',
                    entityId: exchangeOrder._id,
                    details: `Exchange ${exchangeNumber}: ${returnedItems.length} item(s) exchanged, price difference ${diff.toFixed(2)}`,
                },
            ],
            { session }
        );

        await session.commitTransaction();

        await bumpCacheVersion(req.tenantId!.toString());
        await bumpCacheVersion(req.tenantId!.toString(), 'orders');
        for (const item of [...returnedItems, ...newItems]) {
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

        const populated = await ExchangeOrder.findById(exchangeOrder._id).populate('newOrder').populate('returnOrder');
        res.status(201).json(new ApiResponse(201, populated, 'Exchange processed successfully'));
    } catch (err: any) {
        await session.abortTransaction();
        res.status(400).json(new ApiResponse(400, null, err.message || 'Failed to process exchange'));
    } finally {
        session.endSession();
    }
});

// @desc    List exchanges for the current store
// @route   GET /api/exchanges
export const getExchanges = asyncHandler(async (req: TenantRequest, res: Response) => {
    const exchanges = await ExchangeOrder.find({ storeId: req.tenantId })
        .populate('originalOrder', 'orderNumber')
        .populate('newOrder', 'orderNumber grandTotal')
        .populate('returnOrder', 'returnNumber')
        .sort({ createdAt: -1 });
    res.status(200).json(new ApiResponse(200, exchanges));
});
