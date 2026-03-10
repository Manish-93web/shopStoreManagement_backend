import mongoose, { Schema } from 'mongoose';
const PlanSchema = new Schema({
    name: { type: String, required: true, unique: true },
    price: { type: Number, required: true },
    billingCycle: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
    features: [{ type: String }],
    maxUsers: { type: Number, default: 5 },
    maxStores: { type: Number, default: 1 },
    maxProducts: { type: Number, default: 100 },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });
export default mongoose.model('Plan', PlanSchema);
