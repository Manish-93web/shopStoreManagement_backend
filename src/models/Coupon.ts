import mongoose, { Schema, Document } from 'mongoose';

export interface ICoupon extends Document {
    code: string;
    description?: string;
    discountType: 'Percentage' | 'FixedAmount';
    discountValue: number;
    minPurchaseAmount: number;
    maxDiscountAmount?: number;
    validFrom: Date;
    validTo: Date;
    usageLimitTotal?: number; // Max times this coupon can be used platform-wide
    usageLimitPerCustomer?: number; // Max times per customer
    usageCount: number;
    isActive: boolean;
    storeId: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const CouponSchema: Schema = new Schema({
    code: { type: String, required: true, uppercase: true, trim: true },
    description: { type: String },
    discountType: { type: String, enum: ['Percentage', 'FixedAmount'], required: true },
    discountValue: { type: Number, required: true },
    minPurchaseAmount: { type: Number, default: 0 },
    maxDiscountAmount: { type: Number },
    validFrom: { type: Date, default: Date.now },
    validTo: { type: Date, required: true },
    usageLimitTotal: { type: Number },
    usageLimitPerCustomer: { type: Number, default: 1 },
    usageCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true }
}, { timestamps: true });

CouponSchema.index({ code: 1, storeId: 1 }, { unique: true });

export default mongoose.model<ICoupon>('Coupon', CouponSchema);
