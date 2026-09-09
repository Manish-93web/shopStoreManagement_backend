import mongoose, { Schema, Document } from 'mongoose';

export interface IProductVariant extends Document {
    productId: mongoose.Types.ObjectId;
    name: string; // e.g., "Size: L, Color: Red"
    sku: string;
    barcode?: string;
    price?: number; // Override parent price
    costPrice?: number; // Override parent cost price
    images: string[];
    attributes: Map<string, string>; // e.g., { "size": "L", "color": "Red" }
    storeId: mongoose.Types.ObjectId;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const ProductVariantSchema: Schema = new Schema({
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    sku: { type: String, required: true, unique: true },
    barcode: { type: String, unique: true, sparse: true },
    price: { type: Number },
    costPrice: { type: Number },
    images: [{ type: String }],
    attributes: { type: Map, of: String },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model<IProductVariant>('ProductVariant', ProductVariantSchema);
