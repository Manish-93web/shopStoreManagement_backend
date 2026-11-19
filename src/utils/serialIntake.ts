import mongoose from 'mongoose';
import ProductSerial from '../models/ProductSerial.js';

type Id = mongoose.Types.ObjectId | string;

export const cleanSerials = (input: unknown): string[] =>
    Array.isArray(input) ? input.map((s) => String(s).trim()).filter(Boolean) : [];

// Checks a list of serial numbers coming in with stock: one per unit, no repeats, none already in this store.
// Returns a message when something is wrong, or null when they can be saved.
export const serialProblem = async (
    storeId: Id,
    serials: string[],
    quantity: number,
    productName: string
): Promise<string | null> => {
    if (serials.length !== quantity || !Number.isInteger(quantity)) {
        return `Enter ${quantity} serial number${quantity === 1 ? '' : 's'} for "${productName}" (one per unit).`;
    }
    if (new Set(serials).size !== serials.length) return `"${productName}" has a serial number listed twice.`;
    const clash = await ProductSerial.findOne({ storeId, serialNumber: { $in: serials } }).select('serialNumber');
    if (clash) return `Serial number ${clash.serialNumber} already exists.`;
    return null;
};

export const saveSerials = async (
    storeId: Id,
    product: Id,
    variant: Id | undefined | null,
    serials: string[],
    reference: string
): Promise<void> => {
    if (serials.length === 0) return;
    await ProductSerial.insertMany(
        serials.map((serialNumber) => ({
            serialNumber,
            product,
            variant: variant || undefined,
            storeId,
            status: 'In Stock',
            history: [{ action: `Received (${reference})`, date: new Date() }],
        })),
        { ordered: false }
    );
};
