import mongoose, { Schema, Document } from 'mongoose';

export interface IPurchaseOrderItem {
    product: mongoose.Types.ObjectId;
    variant?: mongoose.Types.ObjectId;
    name: string;
    quantity: number;
    receivedQuantity: number;
    costPrice: number;
    total: number;
}

export interface IPurchaseOrder extends Document {
    poNumber: string;
    storeId: mongoose.Types.ObjectId;
    supplier: mongoose.Types.ObjectId;
    items: IPurchaseOrderItem[];
    subTotal: number;
    taxTotal: number;
    grandTotal: number;
    status: 'Draft' | 'Sent' | 'Approved' | 'Partially Received' | 'Received' | 'Cancelled';
    createdBy: mongoose.Types.ObjectId;
    receivedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const PurchaseOrderSchema: Schema = new Schema(
    {
        poNumber: { type: String, required: true, unique: true },
        storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
        supplier: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true },
        items: [
            {
                product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
                variant: { type: Schema.Types.ObjectId, ref: 'ProductVariant' },
                name: { type: String, required: true },
                quantity: { type: Number, required: true },
                receivedQuantity: { type: Number, default: 0 },
                costPrice: { type: Number, required: true },
                total: { type: Number, required: true },
            },
        ],
        subTotal: { type: Number, required: true },
        taxTotal: { type: Number, default: 0 },
        grandTotal: { type: Number, required: true },
        status: {
            type: String,
            enum: ['Draft', 'Sent', 'Approved', 'Partially Received', 'Received', 'Cancelled'],
            default: 'Draft',
        },
        createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        receivedAt: { type: Date },
    },
    { timestamps: true }
);

export default mongoose.model<IPurchaseOrder>('PurchaseOrder', PurchaseOrderSchema);
