import mongoose, { Schema } from 'mongoose';
const ActivityLogSchema = new Schema({
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    message: { type: String, required: true },
    type: { type: String, enum: ['INFO', 'WARNING', 'ERROR', 'SUCCESS'], default: 'INFO' },
    metadata: { type: Schema.Types.Mixed },
}, { timestamps: { createdAt: true, updatedAt: false } });
ActivityLogSchema.index({ storeId: 1, createdAt: -1 });
export default mongoose.model('ActivityLog', ActivityLogSchema);
