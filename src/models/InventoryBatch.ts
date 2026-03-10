import mongoose, { Schema, Document } from 'mongoose';

export interface IInventoryBatch extends Document {
    batchNumber: string;
    product: mongoose.Types.ObjectId;
    variant?: mongoose.Types.ObjectId;
    storeId: mongoose.Types.ObjectId;
    supplier?: mongoose.Types.ObjectId;
    purchaseOrder?: mongoose.Types.ObjectId;
    initialQuantity: number;
    currentQuantity: number;
    costPrice: number;
    sellingPrice?: number;
    manufacturingDate?: Date;
    expiryDate?: Date;
    status: 'Active' | 'Expired' | 'Recalled' | 'Quarantined';
    createdAt: Date;
    updatedAt: Date;
}

const InventoryBatchSchema: Schema = new Schema({
    batchNumber: { type: String, required: true },
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variant: { type: Schema.Types.ObjectId, ref: 'ProductVariant' },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    supplier: { type: Schema.Types.ObjectId, ref: 'Supplier' },
    purchaseOrder: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder' },
    initialQuantity: { type: Number, required: true },
    currentQuantity: { type: Number, required: true },
    costPrice: { type: Number, required: true },
    sellingPrice: { type: Number },
    manufacturingDate: { type: Date },
    expiryDate: { type: Date },
    status: { type: String, enum: ['Active', 'Expired', 'Recalled', 'Quarantined'], default: 'Active' },
}, { timestamps: true });

// Batch number unique per product variant in a store
InventoryBatchSchema.index({ batchNumber: 1, product: 1, variant: 1, storeId: 1 }, { unique: true });

export default mongoose.model<IInventoryBatch>('InventoryBatch', InventoryBatchSchema);
