import mongoose, { Schema } from 'mongoose';
const ProductVariantSchema = new Schema({
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
export default mongoose.model('ProductVariant', ProductVariantSchema);
