import mongoose, { Schema } from 'mongoose';
const ApiRequestLogSchema = new Schema({
    apiKeyId: { type: Schema.Types.ObjectId, ref: 'ApiKey', required: true },
    tenantId: { type: String, required: true, index: true },
    method: { type: String, required: true },
    path: { type: String, required: true },
    statusCode: { type: Number, required: true },
}, { timestamps: { createdAt: true, updatedAt: false } });
ApiRequestLogSchema.index({ apiKeyId: 1, createdAt: -1 });
export default mongoose.model('ApiRequestLog', ApiRequestLogSchema);
