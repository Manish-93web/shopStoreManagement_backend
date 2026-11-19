import StockMovement from '../models/StockMovement.js';
import PriceHistory from '../models/PriceHistory.js';
import Inventory from '../models/Inventory.js';
// The Inventory row of a base product, or of one of its variants.
export const inventoryFilter = (storeId, product, variant) => variant ? { store: storeId, product, variant } : { store: storeId, product, variant: { $exists: false } };
// Write one line in the stock ledger. Call it right AFTER the Inventory quantity was changed — the
// stock on hand is read back as the balance. It never throws: a ledger hiccup must not fail a sale.
export const recordStockMovement = async (m) => {
    try {
        const inv = await Inventory.findOne(inventoryFilter(m.storeId, m.product, m.variant)).session(m.session || null);
        await StockMovement.create([
            {
                storeId: m.storeId,
                product: m.product,
                variant: m.variant || undefined,
                type: m.type,
                quantity: m.quantity,
                balanceAfter: inv?.quantity,
                reference: m.reference,
                referenceId: m.referenceId,
                notes: m.notes,
                createdBy: m.userId,
            },
        ], m.session ? { session: m.session } : undefined);
    }
    catch (err) {
        console.error('Stock ledger write failed:', err.message);
    }
};
export const recordPriceChange = async (p) => {
    if (typeof p.newValue !== 'number' || (p.oldValue ?? 0) === p.newValue)
        return;
    try {
        await PriceHistory.create({
            storeId: p.storeId,
            product: p.product,
            field: p.field,
            oldValue: p.oldValue ?? 0,
            newValue: p.newValue,
            source: p.source || 'Manual',
            note: p.note,
            changedBy: p.userId,
        });
    }
    catch (err) {
        console.error('Price history write failed:', err.message);
    }
};
