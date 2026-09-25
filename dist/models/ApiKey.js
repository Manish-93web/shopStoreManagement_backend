import mongoose, { Schema } from 'mongoose';
const ApiKeySchema = new Schema({
    name: { type: String, required: true },
    keyHash: { type: String, required: true, select: false }, // Never return hash natively
    prefix: { type: String, required: true },
    tenantId: { type: String, required: true, index: true },
    permissions: { type: [String], default: ['read:all'] },
    isActive: { type: Boolean, default: true },
    lastUsedAt: { type: Date },
    usageCount: { type: Number, default: 0 }
}, { timestamps: true });
export default mongoose.model('ApiKey', ApiKeySchema);
