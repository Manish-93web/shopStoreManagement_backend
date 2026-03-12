import mongoose, { Schema, Document } from 'mongoose';

export interface IArchiveJob extends Document {
    storeId: mongoose.Types.ObjectId;
    collectionName: string;
    dateRange: {
        from: Date;
        to: Date;
    };
    status: 'Pending' | 'Running' | 'Completed' | 'Failed';
    archivedCount: number;
    fileUrl?: string; // If we export archived data to a file
    triggeredBy: mongoose.Types.ObjectId;
    error?: string;
    createdAt: Date;
    updatedAt: Date;
}

const ArchiveJobSchema: Schema = new Schema({
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    collectionName: { type: String, required: true },
    dateRange: {
        from: { type: Date, required: true },
        to: { type: Date, required: true }
    },
    status: { type: String, enum: ['Pending', 'Running', 'Completed', 'Failed'], default: 'Pending' },
    archivedCount: { type: Number, default: 0 },
    fileUrl: { type: String },
    triggeredBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    error: { type: String }
}, { timestamps: true });

ArchiveJobSchema.index({ storeId: 1, createdAt: -1 });

export default mongoose.model<IArchiveJob>('ArchiveJob', ArchiveJobSchema);
