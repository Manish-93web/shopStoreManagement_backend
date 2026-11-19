import Product from '../models/Product.js';
// A combo (bundle) has no stock of its own: selling it takes stock from its components.
// Turns bill/return lines into the lines that actually move stock — a normal line stays as it is,
// a combo line becomes one line per component (component quantity x combo quantity).
export const expandForStock = async (storeId, items) => {
    const ids = [...new Set(items.map((i) => String(i.product)))];
    const combos = await Product.find({ _id: { $in: ids }, storeId, isCombo: true })
        .select('name comboItems')
        .lean();
    if (combos.length === 0)
        return items;
    const comboById = new Map(combos.map((c) => [c._id.toString(), c]));
    const componentIds = combos.flatMap((c) => c.comboItems.map((ci) => ci.product));
    const components = await Product.find({ _id: { $in: componentIds }, storeId })
        .select('name')
        .lean();
    const nameById = new Map(components.map((p) => [p._id.toString(), p.name]));
    const out = [];
    for (const item of items) {
        const combo = comboById.get(String(item.product));
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
