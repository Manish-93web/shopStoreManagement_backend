import mongoose, { Schema, Document } from 'mongoose';

export interface ITaxRule extends Document {
    name: string;
    rate: number; // e.g., 18
    type: 'Percentage' | 'Fixed';
    isInclusive: boolean;
    description?: string;
    storeId: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const TaxRuleSchema: Schema = new Schema({
    name: { type: String, required: true },
    rate: { type: Number, required: true },
    type: { type: String, enum: ['Percentage', 'Fixed'], default: 'Percentage' },
    isInclusive: { type: Boolean, default: false },
    description: { type: String },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
}, { timestamps: true });

export default mongoose.model<ITaxRule>('TaxRule', TaxRuleSchema);
