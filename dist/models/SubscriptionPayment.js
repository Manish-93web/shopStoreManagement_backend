import mongoose, { Schema } from 'mongoose';
const SubscriptionPaymentSchema = new Schema({
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
export default mongoose.model('SubscriptionPayment', SubscriptionPaymentSchema);
