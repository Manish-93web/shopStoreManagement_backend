import mongoose, { Schema } from 'mongoose';
const CategorySchema = new Schema({
    name: { type: String, required: true },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    parentId: { type: Schema.Types.ObjectId, ref: 'Category' },
    description: { type: String },
}, { timestamps: true });
// Prevent duplicate category names under the same parent within a store
CategorySchema.index({ storeId: 1, name: 1, parentId: 1 }, { unique: true });
export default mongoose.model('Category', CategorySchema);
