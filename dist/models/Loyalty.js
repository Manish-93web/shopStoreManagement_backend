import mongoose, { Schema } from 'mongoose';
const LoyaltySchema = new Schema({
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    storeId: { type: String, required: true, index: true },
    points: { type: Number, default: 0 },
    totalEarned: { type: Number, default: 0 },
    totalRedeemed: { type: Number, default: 0 },
    tier: { type: String, enum: ['Silver', 'Gold', 'Platinum'], default: 'Silver' },
    lifetimeSpent: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now }
}, { timestamps: true });
LoyaltySchema.index({ customer: 1, storeId: 1 }, { unique: true });
export default mongoose.model('Loyalty', LoyaltySchema);
