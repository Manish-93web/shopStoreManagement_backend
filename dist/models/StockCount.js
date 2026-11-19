import mongoose, { Schema } from 'mongoose';
const StockCountSchema = new Schema({
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    countNumber: { type: String, required: true },
    title: { type: String },
    status: { type: String, enum: ['Draft', 'Completed'], default: 'Draft' },
    items: [
        {
            product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
            variant: { type: Schema.Types.ObjectId, ref: 'ProductVariant' },
            name: { type: String, required: true },
            sku: { type: String },
            unit: { type: String },
            systemQty: { type: Number, required: true },
            countedQty: { type: Number },
            difference: { type: Number },
        },
    ],
    notes: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    completedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    completedAt: { type: Date },
}, { timestamps: true });
StockCountSchema.index({ storeId: 1, countNumber: 1 }, { unique: true });
export default mongoose.model('StockCount', StockCountSchema);
