import mongoose, { Schema } from 'mongoose';
const CustomerSchema = new Schema({
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String },
    address: { type: String },
    state: { type: String },
    gstin: { type: String },
    loyaltyPoints: { type: Number, default: 0 },
    walletBalance: { type: Number, default: 0 },
    segment: { type: String, enum: ['Retail', 'Wholesale', 'VIP'], default: 'Retail' },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    notes: { type: String, default: "" },
    tags: [{ type: String }],
}, { timestamps: true });
// Index for fast search
CustomerSchema.index({ phone: 1, storeId: 1 }, { unique: true });
export default mongoose.model('Customer', CustomerSchema);
