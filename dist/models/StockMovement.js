import mongoose, { Schema } from 'mongoose';
export const MOVEMENT_TYPES = [
    'OPENING',
    'PURCHASE',
    'PURCHASE_RETURN',
    'SALE',
    'SALE_CANCEL',
    'SALE_RETURN',
    'EXCHANGE',
    'ADJUSTMENT',
    'STOCK_COUNT',
    'TRANSFER_OUT',
    'TRANSFER_IN',
    'CONVERT_OUT',
    'CONVERT_IN',
];
const StockMovementSchema = new Schema({
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variant: { type: Schema.Types.ObjectId, ref: 'ProductVariant' },
    type: { type: String, enum: MOVEMENT_TYPES, required: true },
    quantity: { type: Number, required: true },
    balanceAfter: { type: Number },
    reference: { type: String },
    referenceId: { type: Schema.Types.ObjectId },
    notes: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: { createdAt: true, updatedAt: false } });
StockMovementSchema.index({ storeId: 1, product: 1, createdAt: -1 });
StockMovementSchema.index({ storeId: 1, createdAt: -1 });
export default mongoose.model('StockMovement', StockMovementSchema);
