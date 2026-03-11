import mongoose, { Schema, Document } from 'mongoose';

export interface ICustomer extends Document {
    name: string;
    phone: string;
    email?: string;
    address?: string;
    loyaltyPoints: number;
    walletBalance: number;
    segment: 'Retail' | 'Wholesale' | 'VIP';
    storeId: mongoose.Types.ObjectId; // Multi-tenancy
    notes?: string;
    tags?: string[];
    createdAt: Date;
    updatedAt: Date;
}

const CustomerSchema: Schema = new Schema({
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String },
    address: { type: String },
    loyaltyPoints: { type: Number, default: 0 },
    walletBalance: { type: Number, default: 0 },
    segment: { type: String, enum: ['Retail', 'Wholesale', 'VIP'], default: 'Retail' },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    notes: { type: String, default: "" },
    tags: [{ type: String }],
}, { timestamps: true });

// Index for fast search
CustomerSchema.index({ phone: 1, storeId: 1 }, { unique: true });

export default mongoose.model<ICustomer>('Customer', CustomerSchema);
