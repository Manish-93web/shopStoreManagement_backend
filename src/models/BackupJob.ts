import mongoose, { Schema, Document } from 'mongoose';

export interface IBackupJob extends Document {
    storeId: mongoose.Types.ObjectId;
    type: 'Full' | 'Incremental';
    status: 'Pending' | 'Running' | 'Completed' | 'Failed';
    fileUrl?: string;
    fileSize?: number;
    triggeredBy: mongoose.Types.ObjectId;
    error?: string;
    createdAt: Date;
    updatedAt: Date;
}

const BackupJobSchema: Schema = new Schema({
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    type: { type: String, enum: ['Full', 'Incremental'], default: 'Full' },
    status: { type: String, enum: ['Pending', 'Running', 'Completed', 'Failed'], default: 'Pending' },
    fileUrl: { type: String },
    fileSize: { type: Number },
    triggeredBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    error: { type: String }
}, { timestamps: true });

// Index for fast lookup by store
BackupJobSchema.index({ storeId: 1, createdAt: -1 });

export default mongoose.model<IBackupJob>('BackupJob', BackupJobSchema);
