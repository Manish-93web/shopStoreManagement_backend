import Inventory from '../models/Inventory.js';
// Stock rows that are at or below their reorder level.
// A product with sizes / colours keeps its own base row only for stock that is not assigned to any size, and
// that is normally 0 once everything sits on the sizes, so the base row of such a product is never "low".
// Its sizes / colours are checked one by one instead (each has its own row).
export const findLowStockRows = async (storeId) => {
    const rows = await Inventory.find({
        store: storeId,
        $expr: { $lte: ['$quantity', '$lowStockThreshold'] },
    })
        .populate('product', 'name sku image barcode isCombo isActive hasVariants')
        .populate('variant', 'name sku isActive');
    return rows.filter((r) => {
        const p = r.product;
        if (!p || p.isCombo || p.isActive === false)
            return false;
        if (p.hasVariants && !r.variant)
            return false;
        if (r.variant && r.variant.isActive === false)
            return false;
        return true;
    });
};
