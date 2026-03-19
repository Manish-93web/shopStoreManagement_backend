import { inventoryAlertService } from '../services/inventoryAlertService.js';
import Store from '../models/Store.js';
/**
 * Main job to run daily inventory health checks
 */
export const runDailyInventoryChecks = async () => {
    console.log("Starting daily inventory audit...");
    const stores = await Store.find({ isActive: true });
    for (const store of stores) {
        try {
            // Check for low stock
            await inventoryAlertService.checkLowStock(store._id.toString());
            // Check for expiring batches
            await inventoryAlertService.checkExpiringBatches(store._id.toString());
        }
        catch (error) {
            console.error(`Invenotry check failed for store ${store.name}:`, error);
        }
    }
};
