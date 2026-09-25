import mongoose, { Schema, Document } from 'mongoose';

// Cold storage for orders moved out of the live Order collection by
// archiveService.archiveOldOrders. Keeps the *entire* original document as-is
// (rather than a re-typed copy of the Order schema) so a restore is an exact,
// lossless re-insert regardless of how the Order schema evolves over time.
export interface IArchivedOrder extends Document {
    storeId: mongoose.Types.ObjectId;
    archiveJobId: mongoose.Types.ObjectId;
    originalId: mongoose.Types.ObjectId;
    data: any;
    archivedAt: Date;
}

const ArchivedOrderSchema: Schema = new Schema({
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    archiveJobId: { type: Schema.Types.ObjectId, ref: 'ArchiveJob', required: true },
    originalId: { type: Schema.Types.ObjectId, required: true },
    data: { type: Schema.Types.Mixed, required: true },
    archivedAt: { type: Date, default: Date.now },
});

ArchivedOrderSchema.index({ storeId: 1, archiveJobId: 1 });
ArchivedOrderSchema.index({ originalId: 1 });

export default mongoose.model<IArchivedOrder>('ArchivedOrder', ArchivedOrderSchema);
