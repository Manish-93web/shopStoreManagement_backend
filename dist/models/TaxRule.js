import mongoose, { Schema } from 'mongoose';
const TaxRuleSchema = new Schema({
    name: { type: String, required: true },
    rate: { type: Number, required: true },
    type: { type: String, enum: ['Percentage', 'Fixed'], default: 'Percentage' },
    isInclusive: { type: Boolean, default: false },
    description: { type: String },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
}, { timestamps: true });
export default mongoose.model('TaxRule', TaxRuleSchema);
