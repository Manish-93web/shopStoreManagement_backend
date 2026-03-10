import mongoose, { Schema, Document } from 'mongoose';

export interface IBrand extends Document {
    name: string;
    logo?: string;
    description?: string;
    storeId: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const BrandSchema: Schema = new Schema({
    name: { type: String, required: true },
    logo: { type: String },
    description: { type: String },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
}, { timestamps: true });

export default mongoose.model<IBrand>('Brand', BrandSchema);
