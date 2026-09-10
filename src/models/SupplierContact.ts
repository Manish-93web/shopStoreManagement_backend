import mongoose, { Schema, Document } from 'mongoose';

export interface ISupplierContact extends Document {
    storeId: mongoose.Types.ObjectId;
    supplierId: mongoose.Types.ObjectId;
    method: 'Call' | 'Email' | 'Meeting' | 'Other';
    summary: string;
    contactedAt: Date;
    loggedBy: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const SupplierContactSchema: Schema = new Schema(
    {
        storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
        supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true },
        method: {
            type: String,
            enum: ['Call', 'Email', 'Meeting', 'Other'],
            required: true,
        },
        summary: { type: String, required: true },
        contactedAt: { type: Date, default: Date.now },
        loggedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    },
    { timestamps: true }
);

SupplierContactSchema.index({ storeId: 1, supplierId: 1, contactedAt: -1 });

export default mongoose.model<ISupplierContact>('SupplierContact', SupplierContactSchema);
