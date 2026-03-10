import mongoose, { Schema } from 'mongoose';
const BrandSchema = new Schema({
    name: { type: String, required: true },
    logo: { type: String },
    description: { type: String },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
}, { timestamps: true });
export default mongoose.model('Brand', BrandSchema);
