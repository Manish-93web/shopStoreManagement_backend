import mongoose, { Schema } from 'mongoose';
const ArchivedOrderSchema = new Schema({
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    archiveJobId: { type: Schema.Types.ObjectId, ref: 'ArchiveJob', required: true },
    originalId: { type: Schema.Types.ObjectId, required: true },
    data: { type: Schema.Types.Mixed, required: true },
    archivedAt: { type: Date, default: Date.now },
});
ArchivedOrderSchema.index({ storeId: 1, archiveJobId: 1 });
ArchivedOrderSchema.index({ originalId: 1 });
export default mongoose.model('ArchivedOrder', ArchivedOrderSchema);
