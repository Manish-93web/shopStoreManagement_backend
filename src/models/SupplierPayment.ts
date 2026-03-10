import mongoose, { Schema, Document } from 'mongoose';

export interface ISupplierPayment extends Document {
    storeId: mongoose.Types.ObjectId;
    supplierId: mongoose.Types.ObjectId;
    purchaseOrderId?: mongoose.Types.ObjectId;
    amount: number;
    paymentMethod: 'Cash' | 'Bank Transfer' | 'Cheque' | 'Credit';
    paymentDate: Date;
    transactionId?: string;
    notes?: string;
    createdBy: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const SupplierPaymentSchema: Schema = new Schema({
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true },
    purchaseOrderId: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder' },
    amount: { type: Number, required: true },
    paymentMethod: {
        type: String,
        enum: ['Cash', 'Bank Transfer', 'Cheque', 'Credit'],
        required: true
    },
    paymentDate: { type: Date, default: Date.now },
    transactionId: { type: String },
    notes: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

export default mongoose.model<ISupplierPayment>('SupplierPayment', SupplierPaymentSchema);
