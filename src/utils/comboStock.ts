import mongoose from 'mongoose';
import Product from '../models/Product.js';

export type StockItem = { product: any; variant?: any; quantity: number; name: string };

// A combo (bundle) has no stock of its own: selling it takes stock from its components.
// Turns bill/return lines into the lines that actually move stock — a normal line stays as it is,
// a combo line becomes one line per component (component quantity x combo quantity).
export const expandForStock = async (
    storeId: mongoose.Types.ObjectId | string,
    items: { product: any; variant?: any; quantity: number; name: string }[]
): Promise<StockItem[]> => {
    const ids = [...new Set(items.map((i) => String(i.product)))];
    const combos = await Product.find({ _id: { $in: ids }, storeId, isCombo: true })
        .select('name comboItems')
        .lean();
    if (combos.length === 0) return items;

    const comboById = new Map(combos.map((c: any) => [c._id.toString(), c]));
    const componentIds = combos.flatMap((c: any) => c.comboItems.map((ci: any) => ci.product));
    const components = await Product.find({ _id: { $in: componentIds }, storeId })
        .select('name')
        .lean();
    const nameById = new Map(components.map((p: any) => [p._id.toString(), p.name]));

    const out: StockItem[] = [];
    for (const item of items) {
        const combo: any = comboById.get(String(item.product));
        if (!combo) {
            out.push(item);
            continue;
        }
        for (const ci of combo.comboItems) {
            out.push({
                product: ci.product,
                quantity: Math.round(ci.quantity * item.quantity * 1000) / 1000,
                name: nameById.get(String(ci.product)) || combo.name,
            });
        }
    }
    return out;
};
