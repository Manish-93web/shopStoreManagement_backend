import mongoose, { Schema, Document } from 'mongoose';

export interface IPromotionRule extends Document {
    name: string;
    description?: string;
    triggerType: 'TotalCartValue' | 'CategorySpecific' | 'ProductSpecific';
    threshold: number; // e.g., Spend 5000
    targetId?: mongoose.Types.ObjectId; // Category ID or Product ID if specific
    discountType: 'Percentage' | 'FixedAmount';
    discountValue: number;
    priority: number; // For multiple applicable rules
    isActive: boolean;
    storeId: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const PromotionRuleSchema: Schema = new Schema({
    name: { type: String, required: true },
    description: { type: String },
    triggerType: {
        type: String,
        enum: ['TotalCartValue', 'CategorySpecific', 'ProductSpecific'],
        required: true
    },
    threshold: { type: Number, required: true },
    targetId: { type: Schema.Types.ObjectId },
    discountType: { type: String, enum: ['Percentage', 'FixedAmount'], required: true },
    discountValue: { type: Number, required: true },
    priority: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true }
}, { timestamps: true });

export default mongoose.model<IPromotionRule>('PromotionRule', PromotionRuleSchema);
