import mongoose, { Schema } from 'mongoose';
const CustomerDueSchema = new Schema({
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    storeId: { type: String, required: true, index: true },
    balance: { type: Number, default: 0 },
    transactions: [
        {
            type: { type: String, enum: ['CHARGE', 'PAYMENT', 'ADJUSTMENT'], required: true },
            amount: { type: Number, required: true },
            reason: { type: String, required: true },
            orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
            date: { type: Date, default: Date.now },
        },
    ],
}, { timestamps: true });
CustomerDueSchema.index({ customer: 1, storeId: 1 }, { unique: true });
export default mongoose.model('CustomerDue', CustomerDueSchema);
