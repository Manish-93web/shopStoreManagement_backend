import mongoose, { Schema, Document } from 'mongoose';

export interface IDiscount extends Document {
    code: string;
    type: 'Percentage' | 'FixedAmount' | 'BOGO';
    value: number; // For Percentage/Fixed
    buyQuantity?: number; // For BOGO
    getQuantity?: number; // For BOGO
    minPurchase?: number;
    maxDiscount?: number;
    startDate: Date;
    endDate: Date;
    isActive: boolean;
    storeId: mongoose.Types.ObjectId;
}

const DiscountSchema: Schema = new Schema({
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

export default mongoose.model<IDiscount>('Discount', DiscountSchema);
