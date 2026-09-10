import mongoose, { Schema } from 'mongoose';
const StoreSchema = new Schema({
    name: { type: String, required: true },
    logo: { type: String },
    currency: {
        code: { type: String, default: 'INR' },
        symbol: { type: String, default: '₹' },
    },
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Suspended'],
        default: 'Pending',
    },
    timezone: { type: String, default: 'Asia/Kolkata' },
    shopType: {
        type: String,
        enum: [
            'Shoe',
            'Clothing',
            'Electronics',
            'Grocery',
            'Cosmetic',
            'Medical',
            'Furniture',
            'Hardware',
            'Supermarket',
            'Warehouse',
            'Other',
        ],
        default: 'Other',
    },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    address: { type: String },
    state: { type: String },
    gstin: { type: String },
    phone: { type: String },
    email: { type: String },
    upiId: { type: String },
    isActive: { type: Boolean, default: true },
    subscriptionPlan: { type: Schema.Types.ObjectId, ref: 'Plan' },
    subscriptionStatus: {
        type: String,
        enum: ['Active', 'Past Due', 'Cancelled', 'Trialing'],
        default: 'Trialing',
    },
    trialEndsAt: { type: Date, default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) }, // 14-day trial
    featuresEnabled: [{ type: String }],
    currentMonthOrders: { type: Number, default: 0 },
    currentProductsCount: { type: Number, default: 0 },
    lastBillingDate: { type: Date },
}, { timestamps: true });
StoreSchema.index({ owner: 1 });
StoreSchema.index({ isActive: 1 });
export default mongoose.model('Store', StoreSchema);
