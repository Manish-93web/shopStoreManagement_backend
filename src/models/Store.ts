import mongoose, { Schema, Document } from 'mongoose';

export interface IStore extends Document {
    name: string;
    shopType?: string;
    owner: mongoose.Types.ObjectId;
    logo?: string;
    currency: {
        code: string;
        symbol: string;
    };
    timezone: string;
    address?: string;
    phone?: string;
    email?: string;
    isActive: boolean;
    subscriptionPlan: mongoose.Types.ObjectId;
    subscriptionStatus: 'Active' | 'Past Due' | 'Cancelled' | 'Trialing';
    status: 'Pending' | 'Approved' | 'Suspended';
    trialEndsAt?: Date;
    featuresEnabled: string[];
    currentMonthOrders: number;
    currentProductsCount: number;
    lastBillingDate?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const StoreSchema: Schema = new Schema({
    name: { type: String, required: true },
    logo: { type: String },
    currency: {
        code: { type: String, default: 'INR' },
        symbol: { type: String, default: '₹' }
    },
    status: { 
        type: String, 
        enum: ['Pending', 'Approved', 'Suspended'], 
        default: 'Pending' 
    },
    timezone: { type: String, default: 'Asia/Kolkata' },
    shopType: {
        type: String,
        enum: ['Shoe', 'Clothing', 'Electronics', 'Grocery', 'Cosmetic', 'Medical', 'Furniture', 'Hardware', 'Supermarket', 'Warehouse', 'Other'],
        default: 'Other'
    },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    address: { type: String },
    phone: { type: String },
    email: { type: String },
    isActive: { type: Boolean, default: true },
    subscriptionPlan: { type: Schema.Types.ObjectId, ref: 'Plan' },
    subscriptionStatus: { type: String, enum: ['Active', 'Past Due', 'Cancelled', 'Trialing'], default: 'Trialing' },
    trialEndsAt: { type: Date, default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) }, // 14-day trial
    featuresEnabled: [{ type: String }],
    currentMonthOrders: { type: Number, default: 0 },
    currentProductsCount: { type: Number, default: 0 },
    lastBillingDate: { type: Date },
}, { timestamps: true });

StoreSchema.index({ owner: 1 });
StoreSchema.index({ isActive: 1 });

export default mongoose.model<IStore>('Store', StoreSchema);
