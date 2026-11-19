import mongoose, { Schema } from 'mongoose';
const AdjustmentRequestSchema = new Schema({
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true },
    reason: { type: String, required: true },
    notes: { type: String },
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    decidedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    decidedAt: { type: Date },
}, { timestamps: { createdAt: true, updatedAt: false } });
AdjustmentRequestSchema.index({ storeId: 1, status: 1, createdAt: -1 });
export default mongoose.model('AdjustmentRequest', AdjustmentRequestSchema);
