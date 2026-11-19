import mongoose, { Schema, Document } from 'mongoose';

export interface IInventory extends Document {
    product: mongoose.Types.ObjectId;
    variant?: mongoose.Types.ObjectId; // Optional: only if product has variants
    store: mongoose.Types.ObjectId;
    quantity: number;
    lowStockThreshold: number; // Reorder point
    maxStock?: number; // Upper stock level to order up to
    reorderQty?: number; // Fixed quantity to reorder (optional)
    lastStockUpdate: Date;
}

const InventorySchema: Schema = new Schema(
    {
        product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
        variant: { type: Schema.Types.ObjectId, ref: 'ProductVariant' },
        store: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
        quantity: { type: Number, required: true, default: 0 },
        lowStockThreshold: { type: Number, default: 10 },
        maxStock: { type: Number },
        reorderQty: { type: Number },
        lastStockUpdate: { type: Date, default: Date.now },
    },
    { timestamps: true }
);

// Ensure unique combination of product, store, and variant
InventorySchema.index({ product: 1, store: 1, variant: 1 }, { unique: true });

export default mongoose.model<IInventory>('Inventory', InventorySchema);
