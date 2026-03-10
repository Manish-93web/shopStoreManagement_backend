import mongoose, { Schema } from 'mongoose';
const StockAdjustmentSchema = new Schema({
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: Schema.Types.ObjectId, ref: 'ProductVariant' },
    previousQuantity: { type: Number, required: true },
    newQuantity: { type: Number, required: true },
    adjustmentAmount: { type: Number, required: true },
    reason: {
        type: String,
        enum: ['Damaged', 'Correction', 'Restock', 'Expire', 'Other'],
        default: 'Correction'
    },
    notes: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });
export default mongoose.model('StockAdjustment', StockAdjustmentSchema);
