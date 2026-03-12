import mongoose, { Schema } from 'mongoose';
const AuditLogSchema = new Schema({
    storeId: { type: Schema.Types.ObjectId, ref: 'Store' }, // Optional for Platform actions
    userId: { type: Schema.Types.ObjectId, ref: 'User' }, // Optional for pre-auth actions
    action: { type: String, required: true },
    entity: { type: String, required: true },
    entityId: { type: Schema.Types.ObjectId },
    oldValue: { type: Schema.Types.Mixed },
    newValue: { type: Schema.Types.Mixed },
    details: { type: String },
    ipAddress: { type: String },
    userAgent: { type: String },
}, { timestamps: { createdAt: true, updatedAt: false } });
AuditLogSchema.index({ storeId: 1, action: 1, createdAt: -1 });
export default mongoose.model('AuditLog', AuditLogSchema);
