import mongoose, { Schema, Document } from 'mongoose';

export interface IRefundTransaction extends Document {
    refundNumber: string;
    originalOrder: mongoose.Types.ObjectId;
    returnOrder?: mongoose.Types.ObjectId;
    storeId: mongoose.Types.ObjectId;
    amount: number;
    method: 'Cash' | 'Card' | 'UPI' | 'Store Credit' | 'Original Method';
    status: 'Pending' | 'Completed' | 'Failed';
    processedBy: mongoose.Types.ObjectId;
    transactionId?: string;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}

const RefundTransactionSchema: Schema = new Schema({
    refundNumber: { type: String, required: true, unique: true },
    originalOrder: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    returnOrder: { type: Schema.Types.ObjectId, ref: 'ReturnOrder' },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    amount: { type: Number, required: true },
    method: {
        type: String,
        enum: ['Cash', 'Card', 'UPI', 'Store Credit', 'Original Method'],
        required: true
    },
    status: { type: String, enum: ['Pending', 'Completed', 'Failed'], default: 'Completed' },
    processedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    transactionId: { type: String },
    notes: { type: String },
}, { timestamps: true });

export default mongoose.model<IRefundTransaction>('RefundTransaction', RefundTransactionSchema);
