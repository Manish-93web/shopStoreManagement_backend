import mongoose, { Schema } from 'mongoose';
const PromotionRuleSchema = new Schema({
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
    validFrom: { type: Date },
    validTo: { type: Date },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true }
}, { timestamps: true });
export default mongoose.model('PromotionRule', PromotionRuleSchema);
