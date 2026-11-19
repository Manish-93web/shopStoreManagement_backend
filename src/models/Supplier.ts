import mongoose, { Schema, Document } from 'mongoose';

export interface ISupplier extends Document {
    name: string;
    contactPerson?: string;
    phone: string;
    email?: string;
    address?: string;
    gstin?: string;
    storeId: mongoose.Types.ObjectId; // Multi-tenancy
    createdAt: Date;
    updatedAt: Date;
}

const SupplierSchema: Schema = new Schema(
    {
        name: { type: String, required: true },
        contactPerson: { type: String },
        phone: { type: String, required: true },
        email: { type: String },
        address: { type: String },
        gstin: { type: String, trim: true, uppercase: true },
        notes: { type: String },
        tags: [{ type: String }],
        suppliedProducts: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
        storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    },
    { timestamps: true }
);

export default mongoose.model<ISupplier>('Supplier', SupplierSchema);
