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
