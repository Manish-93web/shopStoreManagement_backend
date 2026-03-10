import mongoose, { Schema, Document } from 'mongoose';

export interface IVariant {
    name: string; // e.g., Size, Color
    options: string[]; // e.g., ['S', 'M', 'L'], ['Red', 'Blue']
}

export interface IProduct extends Document {
    name: string;
    sku: string;
    barcode: string;
    category: mongoose.Types.ObjectId;
    brand?: mongoose.Types.ObjectId; // Changed to ref
    description?: string;
    price: number;
    costPrice: number;
    taxRate: number;
    images: string[];
    hasVariants: boolean;
    storeId: mongoose.Types.ObjectId; // Multi-tenancy (Owner's main account)
    createdAt: Date;
    updatedAt: Date;
}

const ProductSchema: Schema = new Schema({
    name: { type: String, required: true },
    sku: { type: String, required: true, unique: true },
    barcode: { type: String, required: true, unique: true },
    category: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    brand: { type: Schema.Types.ObjectId, ref: 'Brand' },
    description: { type: String },
    price: { type: Number, required: true },
    costPrice: { type: Number, required: true },
    taxRate: { type: Number, default: 0 },
    images: [{ type: String }],
    hasVariants: { type: Boolean, default: false },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
}, { timestamps: true });

export default mongoose.model<IProduct>('Product', ProductSchema);
