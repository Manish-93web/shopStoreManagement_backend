import mongoose from 'mongoose';
import ProductVariant from '../models/ProductVariant.js';
import ProductSerial from '../models/ProductSerial.js';
// Variant SKU/barcode and serial numbers used to be unique across ALL stores. They are now unique per
// store, so the old global indexes must go or two shops using the same code would still clash.
const dropLegacyGlobalIndexes = async () => {
    const legacy = [
        [ProductVariant, 'sku_1'],
        [ProductVariant, 'barcode_1'],
        [ProductSerial, 'serialNumber_1'],
    ];
    for (const [model, index] of legacy) {
        try {
            await model.collection.dropIndex(index);
            console.log(`Dropped legacy index ${model.modelName}.${index}`);
        }
        catch {
            /* already gone */
        }
    }
    await Promise.all([ProductVariant.createIndexes(), ProductSerial.createIndexes()]).catch((e) => console.error('Index creation failed:', e.message));
};
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI || '');
        console.log(`MongoDB Connected: ${conn.connection.host}`);
        await dropLegacyGlobalIndexes();
    }
    catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};
export default connectDB;
