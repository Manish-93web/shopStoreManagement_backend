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
    isActive: boolean;
    subscriptionPlan: 'Free' | 'Basic' | 'Premium' | 'Enterprise';
    plan: 'Basic' | 'Premium' | 'Enterprise';
    subscriptionStatus: 'Active' | 'Past Due' | 'Cancelled' | 'Trialing';
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
    timezone: { type: String, default: 'Asia/Kolkata' },
    shopType: {
        type: String,
        enum: ['Shoe', 'Clothing', 'Electronics', 'Grocery', 'Cosmetic', 'Medical', 'Furniture', 'Hardware', 'Supermarket', 'Other'],
        default: 'Other'
    },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    address: { type: String },
    phone: { type: String },
    email: { type: String },
    isActive: { type: Boolean, default: true },
    subscriptionPlan: { type: String, enum: ['Free', 'Basic', 'Premium', 'Enterprise'], default: 'Free' },
    plan: { type: String, enum: ['Basic', 'Premium', 'Enterprise'], default: 'Basic' },
    subscriptionStatus: { type: String, enum: ['Active', 'Past Due', 'Cancelled', 'Trialing'], default: 'Trialing' },
    trialEndsAt: { type: Date, default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) }, // 14-day trial
    featuresEnabled: [{ type: String }],
    currentMonthOrders: { type: Number, default: 0 },
    currentProductsCount: { type: Number, default: 0 },
    lastBillingDate: { type: Date },
}, { timestamps: true });

export default mongoose.model<IStore>('Store', StoreSchema);
