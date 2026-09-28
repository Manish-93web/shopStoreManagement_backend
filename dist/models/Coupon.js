import mongoose, { Schema } from 'mongoose';
const CouponSchema = new Schema({
    code: { type: String, required: true, uppercase: true, trim: true },
    description: { type: String },
    discountType: { type: String, enum: ['Percentage', 'FixedAmount', 'BOGO'], required: true },
    discountValue: { type: Number, required: true, default: 0 },
    buyQuantity: { type: Number },
    getQuantity: { type: Number },
    minPurchaseAmount: { type: Number, default: 0 },
    maxDiscountAmount: { type: Number },
    validFrom: { type: Date, default: Date.now },
    validTo: { type: Date, required: true },
    usageLimitTotal: { type: Number },
    usageLimitPerCustomer: { type: Number, default: 1 },
    usageCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
}, { timestamps: true });
CouponSchema.index({ code: 1, storeId: 1 }, { unique: true });
export default mongoose.model('Coupon', CouponSchema);
