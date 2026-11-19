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

const ProductVariantSchema: Schema = new Schema(
    {
        productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
        name: { type: String, required: true },
        sku: { type: String, required: true },
        barcode: { type: String },
        price: { type: Number },
        costPrice: { type: Number },
        images: [{ type: String }],
        attributes: { type: Map, of: String },
        storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
);

// SKU and barcode only need to be unique inside one store, like products.
ProductVariantSchema.index({ storeId: 1, sku: 1 }, { unique: true });
ProductVariantSchema.index(
    { storeId: 1, barcode: 1 },
    { unique: true, partialFilterExpression: { barcode: { $type: 'string' } } }
);

export default mongoose.model<IProductVariant>('ProductVariant', ProductVariantSchema);
