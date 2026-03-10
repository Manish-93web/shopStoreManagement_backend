import mongoose, { Schema } from 'mongoose';
const ProductSchema = new Schema({
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
export default mongoose.model('Product', ProductSchema);
