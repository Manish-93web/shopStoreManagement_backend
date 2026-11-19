import mongoose from 'mongoose';
import Inventory from '../models/Inventory.js';
import Product from '../models/Product.js';
import Store from '../models/Store.js';
import StockAdjustment from '../models/StockAdjustment.js';
import AuditLog from '../models/AuditLog.js';
import { notificationService } from '../services/notificationService.js';
import { bumpCacheVersion } from '../config/redis.js';
import { emitToStore } from '../config/socket.js';
import { recordStockMovement } from './stockMovement.js';
export const VALID_ADJUSTMENT_REASONS = ['Damaged', 'Correction', 'Restock', 'Expire', 'Other'];
// Changes a product's stock by a signed quantity and writes everything that goes with it:
// the adjustment record, the stock ledger line, the audit trail, a low-stock alert and the live update.
export const applyStockAdjustment = async (a) => {
    const adjustQty = a.quantity;
    const session = await mongoose.startSession();
    session.startTransaction();
    let inv;
    try {
        inv = await Inventory.findOneAndUpdate({ product: a.productId, store: a.tenantId }, { $inc: { quantity: adjustQty }, $set: { lastStockUpdate: new Date() } }, { new: true, upsert: true, session });
        await StockAdjustment.create([
            {
                productId: a.productId,
                storeId: a.tenantId,
                previousQuantity: (inv?.quantity || 0) - adjustQty,
                newQuantity: inv?.quantity || 0,
                adjustmentAmount: adjustQty,
                type: adjustQty >= 0 ? 'ADD' : 'SUBTRACT',
                reason: a.reason,
                notes: a.notes || '',
                createdBy: a.userId,
            },
        ], { session });
        await session.commitTransaction();
    }
    catch (err) {
        await session.abortTransaction();
        throw err;
    }
    finally {
        session.endSession();
    }
    await recordStockMovement({
        storeId: a.tenantId,
        product: a.productId,
        type: 'ADJUSTMENT',
        quantity: adjustQty,
        reference: a.reason,
        notes: a.notes,
        userId: a.userId,
    });
    await AuditLog.create({
        userId: a.userId,
        storeId: a.tenantId,
        action: 'STOCK_ADJUSTMENT',
        entity: 'Product',
        entityId: a.productId,
        oldValue: (inv?.quantity || 0) - adjustQty,
        newValue: inv?.quantity,
        details: `Stock ${adjustQty >= 0 ? 'increased' : 'decreased'} by ${Math.abs(adjustQty)} (${a.reason}).`,
        ipAddress: a.ip,
        userAgent: a.userAgent,
    });
    if (process.env.SKIP_REDIS !== 'true') {
        await bumpCacheVersion(a.tenantId.toString());
    }
    emitToStore(a.tenantId.toString(), 'inventory-update', {
        productId: a.productId,
        variantId: undefined,
        newQuantity: inv?.quantity,
    });
    if (inv && inv.quantity <= (inv.lowStockThreshold || 5)) {
        const store = await Store.findById(a.tenantId);
        const product = await Product.findById(a.productId);
        if (store && product) {
            await notificationService.send({
                recipientId: store.owner.toString(),
                storeId: a.tenantId.toString(),
                title: `Low Stock Alert`,
                message: `"${product.name}" is running low (${inv.quantity} units remaining).`,
                type: 'WARNING',
                metadata: { productId: product._id },
            });
        }
    }
    return inv;
};
