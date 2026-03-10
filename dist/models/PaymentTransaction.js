import mongoose, { Schema } from 'mongoose';
const PaymentTransactionSchema = new Schema({
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
export default mongoose.model('PaymentTransaction', PaymentTransactionSchema);
