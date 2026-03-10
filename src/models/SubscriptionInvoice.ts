import mongoose, { Schema, Document } from 'mongoose';

export interface ISubscriptionInvoice extends Document {
    invoiceNumber: string;
    storeId: mongoose.Types.ObjectId;
    ownerId: mongoose.Types.ObjectId;
    plan: mongoose.Types.ObjectId;
    amount: number;
    taxAmount: number;
    totalAmount: number;
    currency: string;
    status: 'Draft' | 'Sent' | 'Paid' | 'Void' | 'Overdue';
    dueDate: Date;
    paidAt?: Date;
    billingPeriod: {
        start: Date;
        end: Date;
    };
    pdfUrl?: string;
    createdAt: Date;
    updatedAt: Date;
}

const SubscriptionInvoiceSchema: Schema = new Schema({
    invoiceNumber: { type: String, required: true, unique: true },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    plan: { type: Schema.Types.ObjectId, ref: 'Plan', required: true },
    amount: { type: Number, required: true },
    taxAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    currency: { type: String, default: 'USD' },
    status: {
        type: String,
        enum: ['Draft', 'Sent', 'Paid', 'Void', 'Overdue'],
        default: 'Draft'
    },
    dueDate: { type: Date, required: true },
    paidAt: { type: Date },
    billingPeriod: {
        start: { type: Date, required: true },
        end: { type: Date, required: true }
    },
    pdfUrl: { type: String },
}, { timestamps: true });

export default mongoose.model<ISubscriptionInvoice>('SubscriptionInvoice', SubscriptionInvoiceSchema);
