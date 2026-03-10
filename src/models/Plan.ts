import mongoose, { Schema, Document } from 'mongoose';

export interface IPlan extends Document {
    name: string;
    price: number;
    billingCycle: 'monthly' | 'yearly';
    features: string[];
    maxUsers: number;
    maxStores: number;
    maxProducts: number;
    isActive: boolean;
}

const PlanSchema: Schema = new Schema({
    name: { type: String, required: true, unique: true },
    price: { type: Number, required: true },
    billingCycle: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
    features: [{ type: String }],
    maxUsers: { type: Number, default: 5 },
    maxStores: { type: Number, default: 1 },
    maxProducts: { type: Number, default: 100 },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model<IPlan>('Plan', PlanSchema);
