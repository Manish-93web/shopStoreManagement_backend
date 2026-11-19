import mongoose, { Schema } from 'mongoose';
const PriceHistorySchema = new Schema({
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    field: { type: String, enum: ['price', 'mrp', 'costPrice'], required: true },
    oldValue: { type: Number, default: 0 },
    newValue: { type: Number, required: true },
    source: { type: String, enum: ['Manual', 'Purchase', 'Bulk update', 'Import'], default: 'Manual' },
    note: { type: String },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: { createdAt: true, updatedAt: false } });
PriceHistorySchema.index({ storeId: 1, product: 1, createdAt: -1 });
export default mongoose.model('PriceHistory', PriceHistorySchema);
