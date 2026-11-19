import mongoose, { Schema } from 'mongoose';
const ProductVariantSchema = new Schema({
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
}, { timestamps: true });
// SKU and barcode only need to be unique inside one store, like products.
ProductVariantSchema.index({ storeId: 1, sku: 1 }, { unique: true });
ProductVariantSchema.index({ storeId: 1, barcode: 1 }, { unique: true, partialFilterExpression: { barcode: { $type: 'string' } } });
export default mongoose.model('ProductVariant', ProductVariantSchema);
