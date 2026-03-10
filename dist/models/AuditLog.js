import mongoose, { Schema } from 'mongoose';
const AuditLogSchema = new Schema({
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true },
    entity: { type: String, required: true },
    entityId: { type: Schema.Types.ObjectId },
    oldValue: { type: Schema.Types.Mixed },
    newValue: { type: Schema.Types.Mixed },
    ipAddress: { type: String },
    userAgent: { type: String },
}, { timestamps: { createdAt: true, updatedAt: false } });
AuditLogSchema.index({ storeId: 1, action: 1, createdAt: -1 });
export default mongoose.model('AuditLog', AuditLogSchema);
