import mongoose, { Schema, Document } from 'mongoose';

export interface IProductSerial extends Document {
    serialNumber: string;
    product: mongoose.Types.ObjectId;
    variant?: mongoose.Types.ObjectId;
    storeId: mongoose.Types.ObjectId;
    batch?: mongoose.Types.ObjectId;
    status: 'In Stock' | 'Sold' | 'Returned' | 'Damaged' | 'Transferred';
    currentOrder?: mongoose.Types.ObjectId;
    history: {
        action: string;
        date: Date;
        referenceId?: mongoose.Types.ObjectId;
        notes?: string;
    }[];
    warrantyExpiry?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const ProductSerialSchema: Schema = new Schema({
    serialNumber: { type: String, required: true, unique: true },
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variant: { type: Schema.Types.ObjectId, ref: 'ProductVariant' },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    batch: { type: Schema.Types.ObjectId, ref: 'InventoryBatch' },
    status: {
        type: String,
        enum: ['In Stock', 'Sold', 'Returned', 'Damaged', 'Transferred'],
        default: 'In Stock'
    },
    currentOrder: { type: Schema.Types.ObjectId, ref: 'Order' },
    history: [{
        action: { type: String, required: true },
        date: { type: Date, default: Date.now },
        referenceId: { type: Schema.Types.ObjectId },
        notes: { type: String }
    }],
    warrantyExpiry: { type: Date },
}, { timestamps: true });

export default mongoose.model<IProductSerial>('ProductSerial', ProductSerialSchema);
