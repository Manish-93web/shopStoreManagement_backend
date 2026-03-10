import mongoose, { Schema } from 'mongoose';
const DiscountSchema = new Schema({
    code: { type: String, required: true },
    type: { type: String, enum: ['Percentage', 'FixedAmount', 'BOGO'], required: true },
    value: { type: Number, required: true, default: 0 },
    buyQuantity: { type: Number },
    getQuantity: { type: Number },
    minPurchase: { type: Number, default: 0 },
    maxDiscount: { type: Number },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
}, { timestamps: true });
// Ensure unique code per store
DiscountSchema.index({ code: 1, storeId: 1 }, { unique: true });
export default mongoose.model('Discount', DiscountSchema);
