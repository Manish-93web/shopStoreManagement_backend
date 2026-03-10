import mongoose, { Schema } from 'mongoose';
const StoreSchema = new Schema({
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
export default mongoose.model('Store', StoreSchema);
