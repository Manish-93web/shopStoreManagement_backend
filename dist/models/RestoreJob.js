import mongoose, { Schema } from 'mongoose';
const RestoreJobSchema = new Schema({
    backupJobId: { type: Schema.Types.ObjectId, ref: 'BackupJob', required: true },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    status: { type: String, enum: ['Pending', 'Running', 'Completed', 'Failed'], default: 'Pending' },
    restoredBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    error: { type: String }
}, { timestamps: true });
RestoreJobSchema.index({ storeId: 1, createdAt: -1 });
export default mongoose.model('RestoreJob', RestoreJobSchema);
