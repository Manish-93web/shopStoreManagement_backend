import mongoose, { Schema } from 'mongoose';
const BackupJobSchema = new Schema({
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    type: { type: String, enum: ['Full', 'Incremental'], default: 'Full' },
    status: { type: String, enum: ['Pending', 'Running', 'Completed', 'Failed'], default: 'Pending' },
    fileUrl: { type: String },
    fileSize: { type: Number },
    storageLocation: { type: String, enum: ['local', 's3'], default: 'local' },
    triggeredBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    error: { type: String }
}, { timestamps: true });
// Index for fast lookup by store
BackupJobSchema.index({ storeId: 1, createdAt: -1 });
export default mongoose.model('BackupJob', BackupJobSchema);
