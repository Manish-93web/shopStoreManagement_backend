import ProductSerial from '../models/ProductSerial.js';
export const cleanSerials = (input) => Array.isArray(input) ? input.map((s) => String(s).trim()).filter(Boolean) : [];
// Checks a list of serial numbers coming in with stock: one per unit, no repeats, none already in this store.
// Returns a message when something is wrong, or null when they can be saved.
export const serialProblem = async (storeId, serials, quantity, productName) => {
    if (serials.length !== quantity || !Number.isInteger(quantity)) {
        return `Enter ${quantity} serial number${quantity === 1 ? '' : 's'} for "${productName}" (one per unit).`;
    }
    if (new Set(serials).size !== serials.length)
        return `"${productName}" has a serial number listed twice.`;
    const clash = await ProductSerial.findOne({ storeId, serialNumber: { $in: serials } }).select('serialNumber');
    if (clash)
        return `Serial number ${clash.serialNumber} already exists.`;
    return null;
};
export const saveSerials = async (storeId, product, variant, serials, reference) => {
    if (serials.length === 0)
        return;
    await ProductSerial.insertMany(serials.map((serialNumber) => ({
        serialNumber,
        product,
        variant: variant || undefined,
        storeId,
        status: 'In Stock',
        history: [{ action: `Received (${reference})`, date: new Date() }],
    })), { ordered: false });
};
