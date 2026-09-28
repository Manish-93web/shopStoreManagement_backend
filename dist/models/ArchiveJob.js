import mongoose, { Schema } from 'mongoose';
const ArchiveJobSchema = new Schema({
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    collectionName: { type: String, required: true },
    dateRange: {
        from: { type: Date, required: true },
        to: { type: Date, required: true },
    },
    status: { type: String, enum: ['Pending', 'Running', 'Completed', 'Failed'], default: 'Pending' },
    archivedCount: { type: Number, default: 0 },
    fileUrl: { type: String },
    triggeredBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    error: { type: String },
    restoredAt: { type: Date },
}, { timestamps: true });
ArchiveJobSchema.index({ storeId: 1, createdAt: -1 });
export default mongoose.model('ArchiveJob', ArchiveJobSchema);
