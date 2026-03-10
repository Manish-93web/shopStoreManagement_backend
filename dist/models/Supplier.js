import mongoose, { Schema } from 'mongoose';
const SupplierSchema = new Schema({
    name: { type: String, required: true },
    contactPerson: { type: String },
    phone: { type: String, required: true },
    email: { type: String },
    address: { type: String },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
}, { timestamps: true });
export default mongoose.model('Supplier', SupplierSchema);
