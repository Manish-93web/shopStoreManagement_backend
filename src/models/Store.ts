import mongoose, { Schema, Document } from 'mongoose';

export interface IStore extends Document {
    name: string;
    owner: mongoose.Types.ObjectId;
    address?: string;
    phone?: string;
    email?: string;
    isActive: boolean;
    subscriptionPlan: 'Free' | 'Basic' | 'Premium' | 'Enterprise';
    plan: 'Basic' | 'Premium' | 'Enterprise';
    subscriptionStatus: 'Active' | 'Past Due' | 'Cancelled';
    lastBillingDate?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const StoreSchema: Schema = new Schema({
    name: { type: String, required: true },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    address: { type: String },
    phone: { type: String },
    email: { type: String },
    isActive: { type: Boolean, default: true },
    subscriptionPlan: { type: String, enum: ['Free', 'Basic', 'Premium', 'Enterprise'], default: 'Free' },
    plan: { type: String, enum: ['Basic', 'Premium', 'Enterprise'], default: 'Basic' },
    subscriptionStatus: { type: String, enum: ['Active', 'Past Due', 'Cancelled'], default: 'Active' },
    lastBillingDate: { type: Date },
}, { timestamps: true });

export default mongoose.model<IStore>('Store', StoreSchema);
