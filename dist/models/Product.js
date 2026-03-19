import mongoose, { Schema } from 'mongoose';
const ProductSchema = new Schema({
    name: { type: String, required: true },
    sku: { type: String, required: true },
    barcode: { type: String, required: true },
    category: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    brand: { type: Schema.Types.ObjectId, ref: 'Brand' },
    description: { type: String },
    price: { type: Number, required: true },
    costPrice: { type: Number, required: true },
    taxRate: { type: Number, default: 0 },
    images: [{ type: String }],
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
}, { timestamps: true });
// Compound indexes to allow same SKU/Barcode across different stores/tenants
ProductSchema.index({ storeId: 1, sku: 1 }, { unique: true });
ProductSchema.index({ storeId: 1, barcode: 1 }, { unique: true });
export default mongoose.model('Product', ProductSchema);
