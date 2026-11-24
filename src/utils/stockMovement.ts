import mongoose from 'mongoose';
import StockMovement, { MovementType } from '../models/StockMovement.js';
import PriceHistory from '../models/PriceHistory.js';
import Inventory from '../models/Inventory.js';

type Id = mongoose.Types.ObjectId | string;

// The Inventory row of a base product, or of one of its variants.
export const inventoryFilter = (storeId: Id, product: Id, variant?: Id | null) =>
    variant ? { store: storeId, product, variant } : { store: storeId, product, variant: { $exists: false } };

// Write one line in the stock ledger. Call it right AFTER the Inventory quantity was changed — the
// stock on hand is read back as the balance. It never throws: a ledger hiccup must not fail a sale.
export const recordStockMovement = async (m: {
    storeId: Id;
    product: Id;
    variant?: Id | null;
    type: MovementType;
    quantity: number; // signed
    reference?: string;
    referenceId?: Id;
    notes?: string;
    userId?: Id;
    session?: mongoose.ClientSession;
}): Promise<void> => {
    try {
        const inv = await Inventory.findOne(inventoryFilter(m.storeId, m.product, m.variant)).session(
            m.session || null
        );
        await StockMovement.create(
            [
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
            ],
            m.session ? { session: m.session } : undefined
        );
    } catch (err) {
        console.error('Stock ledger write failed:', (err as Error).message);
    }
};

export const recordPriceChange = async (p: {
    storeId: Id;
    product: Id;
    field: 'price' | 'mrp' | 'costPrice';
    oldValue?: number;
    newValue?: number;
    source?: 'Manual' | 'Purchase' | 'Bulk update' | 'Import';
    note?: string;
    userId?: Id;
}): Promise<void> => {
    if (typeof p.newValue !== 'number' || (p.oldValue ?? 0) === p.newValue) return;
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
    } catch (err) {
        console.error('Price history write failed:', (err as Error).message);
    }
};

// A product that gets sizes / colours keeps the stock it already had as "not assigned to a size yet".
// When a size is created with its own stock, that many units move out of the unassigned stock (as far as it
// reaches), so the product total stays the same instead of growing.
export const takeFromUnassigned = async (storeId: Id, product: Id, quantity: number, userId?: Id): Promise<number> => {
    if (!(quantity > 0)) return 0;
    const base = await Inventory.findOne(inventoryFilter(storeId, product));
    const available = base?.quantity ?? 0;
    const take = Math.min(available, quantity);
    if (take <= 0) return 0;
    await Inventory.updateOne(inventoryFilter(storeId, product), {
        $inc: { quantity: -take },
        $set: { lastStockUpdate: new Date() },
    });
    await recordStockMovement({
        storeId,
        product,
        type: 'ADJUSTMENT',
        quantity: -take,
        reference: 'Assigned to sizes / colours',
        userId,
    });
    return take;
};

// The opposite of takeFromUnassigned: stock taken out of a size / colour goes back to the product's
// unassigned stock, so moving units between sizes never changes the product total.
export const returnToUnassigned = async (storeId: Id, product: Id, quantity: number, userId?: Id): Promise<void> => {
    if (!(quantity > 0)) return;
    await Inventory.findOneAndUpdate(
        inventoryFilter(storeId, product),
        { $inc: { quantity }, $set: { lastStockUpdate: new Date() } },
        { upsert: true }
    );
    await recordStockMovement({
        storeId,
        product,
        type: 'ADJUSTMENT',
        quantity,
        reference: 'Returned from sizes / colours',
        userId,
    });
};
