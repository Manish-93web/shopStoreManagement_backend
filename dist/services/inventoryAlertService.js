import Inventory from '../models/Inventory.js';
import InventoryBatch from '../models/InventoryBatch.js';
import User from '../models/User.js';
import { notificationService } from './notificationService.js';
import dayjs from 'dayjs';
export const inventoryAlertService = {
    /**
     * Checks all products in a store for low stock and sends alerts
     */
    checkLowStock: async (storeId) => {
        const lowStockItems = await Inventory.find({
            store: storeId,
            $expr: { $lte: ['$quantity', '$lowStockThreshold'] }
        }).populate('product', 'name sku');
        if (lowStockItems.length === 0)
            return;
        // Get store owners/managers to notify
        const recipients = await User.find({ storeId, role: { $in: ['Owner', 'Manager'] }, isActive: true });
        for (const recipient of recipients) {
            for (const item of lowStockItems) {
                const product = item.product;
                await notificationService.send({
                    recipientId: recipient._id.toString(),
                    storeId,
                    title: "Low Stock Alert 🚨",
                    message: `Product "${product.name}" (${product.sku}) is running low. Current stock: ${item.quantity}.`,
                    type: 'WARNING',
                    actionUrl: '/inventory'
                });
            }
        }
    },
    /**
     * Checks for batches expiring within the next 30 days
     */
    checkExpiringBatches: async (storeId) => {
        const thirtyDaysFromNow = dayjs().add(30, 'day').toDate();
        const expiringBatches = await InventoryBatch.find({
            storeId,
            status: 'Active',
            expiryDate: { $lte: thirtyDaysFromNow, $gt: new Date() }
        }).populate('product', 'name sku');
        if (expiringBatches.length === 0)
            return;
        const recipients = await User.find({ storeId, role: { $in: ['Owner', 'Manager'] }, isActive: true });
        for (const recipient of recipients) {
            for (const batch of expiringBatches) {
                const product = batch.product;
                await notificationService.send({
                    recipientId: recipient._id.toString(),
                    storeId,
                    title: "Batch Expiry Warning ⚠️",
                    message: `Batch ${batch.batchNumber} of "${product.name}" expires on ${dayjs(batch.expiryDate).format('MMM DD, YYYY')}.`,
                    type: 'ERROR',
                    actionUrl: '/inventory'
                });
            }
        }
    }
};
