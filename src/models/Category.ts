import mongoose, { Schema, Document } from 'mongoose';

export interface ICategory extends Document {
    name: string;
    storeId: mongoose.Types.ObjectId; // Multi-tenancy
    parentId?: mongoose.Types.ObjectId; // For hierarchical categories
    description?: string;
    createdAt: Date;
    updatedAt: Date;
}

const CategorySchema: Schema = new Schema({
    name: { type: String, required: true },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    parentId: { type: Schema.Types.ObjectId, ref: 'Category' },
    description: { type: String },
}, { timestamps: true });

// Prevent duplicate category names under the same parent within a store
CategorySchema.index({ storeId: 1, name: 1, parentId: 1 }, { unique: true });

export default mongoose.model<ICategory>('Category', CategorySchema);
