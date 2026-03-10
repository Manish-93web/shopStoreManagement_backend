import mongoose, { Schema, Document } from 'mongoose';

export interface ISubscriptionPayment extends Document {
    transactionId: string;
    invoiceId: mongoose.Types.ObjectId;
    storeId: mongoose.Types.ObjectId;
    amount: number;
    currency: string;
    gateway: 'Stripe' | 'Razorpay' | 'PayPal' | 'Manual';
    status: 'Pending' | 'Completed' | 'Failed' | 'Refunded';
    paymentMethod: string; // e.g., 'card', 'upi', 'bank_transfer'
    metadata?: any; // Raw response from gateway
    createdAt: Date;
    updatedAt: Date;
}

const SubscriptionPaymentSchema: Schema = new Schema({
    transactionId: { type: String, required: true, unique: true },
    invoiceId: { type: Schema.Types.ObjectId, ref: 'SubscriptionInvoice', required: true },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    gateway: {
        type: String,
        enum: ['Stripe', 'Razorpay', 'PayPal', 'Manual'],
        required: true
    },
    status: { type: String, enum: ['Pending', 'Completed', 'Failed', 'Refunded'], default: 'Pending' },
    paymentMethod: { type: String },
    metadata: { type: Schema.Types.Mixed },
}, { timestamps: true });

export default mongoose.model<ISubscriptionPayment>('SubscriptionPayment', SubscriptionPaymentSchema);
