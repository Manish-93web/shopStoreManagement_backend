import mongoose, { Schema, Document } from 'mongoose';

export interface IStockAdjustment extends Document {
    storeId: mongoose.Types.ObjectId;
    productId: mongoose.Types.ObjectId;
    variantId?: mongoose.Types.ObjectId;
    previousQuantity: number;
    newQuantity: number;
    adjustmentAmount: number; // e.g., -5 or +10
    type: 'ADD' | 'SUBTRACT';
    reason: 'Damaged' | 'Correction' | 'Restock' | 'Expire' | 'Other';
    notes?: string;
    createdBy: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const StockAdjustmentSchema: Schema = new Schema({
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: Schema.Types.ObjectId, ref: 'ProductVariant' },
    previousQuantity: { type: Number, required: true },
    newQuantity: { type: Number, required: true },
    adjustmentAmount: { type: Number, required: true },
    type: { type: String, enum: ['ADD', 'SUBTRACT'], required: true },
    reason: {
        type: String,
        enum: ['Damaged', 'Correction', 'Restock', 'Expire', 'Other'],
        default: 'Correction'
    },
    notes: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

export default mongoose.model<IStockAdjustment>('StockAdjustment', StockAdjustmentSchema);
