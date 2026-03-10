import mongoose, { Schema, Document } from 'mongoose';

export interface IPaymentTransaction extends Document {
    transactionNumber: string;
    storeId: mongoose.Types.ObjectId;
    orderId?: mongoose.Types.ObjectId; // For sales
    returnOrderId?: mongoose.Types.ObjectId; // For returns
    type: 'Inflow' | 'Outflow';
    category: 'Sale' | 'Refund' | 'Supplier Payment' | 'Expense' | 'Transfer' | 'Audit Adjustment';
    method: 'Cash' | 'Card' | 'UPI' | 'Wallet' | 'Store Credit';
    amount: number;
    currency: string;
    status: 'Pending' | 'Completed' | 'Failed' | 'Reversed';
    performedBy: mongoose.Types.ObjectId;
    externalTransactionId?: string;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}

const PaymentTransactionSchema: Schema = new Schema({
    transactionNumber: { type: String, required: true, unique: true },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
    returnOrderId: { type: Schema.Types.ObjectId, ref: 'ReturnOrder' },
    type: { type: String, enum: ['Inflow', 'Outflow'], required: true },
    category: {
        type: String,
        enum: ['Sale', 'Refund', 'Supplier Payment', 'Expense', 'Transfer', 'Audit Adjustment'],
        required: true
    },
    method: {
        type: String,
        enum: ['Cash', 'Card', 'UPI', 'Wallet', 'Store Credit'],
        required: true
    },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    status: { type: String, enum: ['Pending', 'Completed', 'Failed', 'Reversed'], default: 'Completed' },
    performedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    externalTransactionId: { type: String },
    notes: { type: String },
}, { timestamps: true });

export default mongoose.model<IPaymentTransaction>('PaymentTransaction', PaymentTransactionSchema);
