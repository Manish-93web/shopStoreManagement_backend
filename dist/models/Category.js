import mongoose, { Schema } from 'mongoose';
const CategorySchema = new Schema({
    name: { type: String, required: true },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    parentId: { type: Schema.Types.ObjectId, ref: 'Category' },
    description: { type: String },
}, { timestamps: true });
export default mongoose.model('Category', CategorySchema);
