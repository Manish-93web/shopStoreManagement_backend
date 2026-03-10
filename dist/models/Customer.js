import mongoose, { Schema } from 'mongoose';
const CustomerSchema = new Schema({
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String },
    address: { type: String },
    loyaltyPoints: { type: Number, default: 0 },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
}, { timestamps: true });
// Index for fast search
CustomerSchema.index({ phone: 1, storeId: 1 }, { unique: true });
export default mongoose.model('Customer', CustomerSchema);
