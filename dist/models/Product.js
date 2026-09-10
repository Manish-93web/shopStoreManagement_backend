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
    taxRule: { type: Schema.Types.ObjectId, ref: 'TaxRule' },
    hsnCode: { type: String },
    images: [{ type: String }],
    hasVariants: { type: Boolean, default: false },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
}, { timestamps: true });
// Compound indexes to allow same SKU/Barcode across different stores/tenants
ProductSchema.index({ storeId: 1, sku: 1 }, { unique: true });
ProductSchema.index({ storeId: 1, barcode: 1 }, { unique: true });
// Real text index for whole/prefix-word search (e.g. a future public catalog page).
// productController.getProducts deliberately keeps its existing regex-based search as
// the primary query mechanism for the inventory search bar — a text index structurally
// can't accelerate arbitrary mid-string matches (e.g. typing a barcode fragment), which
// the current substring search correctly supports; switching to $text there would
// regress that UX rather than "back" it.
ProductSchema.index({ name: 'text', sku: 'text', barcode: 'text', description: 'text' });
export default mongoose.model('Product', ProductSchema);
