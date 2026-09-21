import mongoose, { Schema, Document } from 'mongoose';

export interface IOrderItem {
    product: mongoose.Types.ObjectId;
    variant?: mongoose.Types.ObjectId;
    name: string;
    quantity: number;
    price: number;
    tax: number;
    hsnCode?: string;
    cgst?: number;
    sgst?: number;
    igst?: number;
    discount: number;
    total: number;
}

export interface IPayment {
    method: 'Cash' | 'Card' | 'UPI' | 'Wallet';
    amount: number;
    transactionId?: string;
}

export interface IPaymentDetail {
    method: 'Cash' | 'Card' | 'UPI' | 'Wallet' | 'Store Credit';
    amount: number;
    reference?: string; // Card last-4/auth ref, UPI transaction ref
    tenderedAmount?: number; // Cash: amount physically handed over
    changeDue?: number; // Cash: change returned to the customer
}

export interface IOrder extends Document {
    orderNumber: string;
    storeId: mongoose.Types.ObjectId;
    customer?: mongoose.Types.ObjectId;
    items: IOrderItem[];
    subTotal: number;
    taxTotal: number;
    taxType: 'Intra-State' | 'Inter-State';
    isGstBill: boolean;
    discountTotal: number;
    discountReason?: string;
    grandTotal: number;
    amountPaid: number;
    amountDue: number;
    loyaltyPointsUsed?: number;
    paymentDetails: IPaymentDetail[];
    status: 'Pending' | 'Completed' | 'Cancelled';
    paymentStatus: 'Unpaid' | 'Paid' | 'Partial';
    cashier: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const OrderSchema: Schema = new Schema(
    {
        orderNumber: { type: String, required: true, unique: true },
        storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
        customer: { type: Schema.Types.ObjectId, ref: 'Customer' },
        items: [
            {
                product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
                variant: { type: Schema.Types.ObjectId, ref: 'ProductVariant' },
                name: { type: String, required: true },
                quantity: { type: Number, required: true },
                price: { type: Number, required: true },
                tax: { type: Number, default: 0 },
                hsnCode: { type: String },
                cgst: { type: Number, default: 0 },
                sgst: { type: Number, default: 0 },
                igst: { type: Number, default: 0 },
                discount: { type: Number, default: 0 },
                total: { type: Number, required: true },
            },
        ],
        subTotal: { type: Number, required: true },
        taxTotal: { type: Number, required: true },
        taxType: { type: String, enum: ['Intra-State', 'Inter-State'], default: 'Intra-State' },
        // Whether this sale was billed as a GST tax invoice or a non-GST bill of
        // supply — a per-transaction cashier choice, not tied to the store's own
        // GST registration (an unregistered/composition dealer, or a sale under the
        // GST threshold, still needs to issue bills without a tax line).
        isGstBill: { type: Boolean, default: true },
        discountTotal: { type: Number, default: 0 },
        discountReason: { type: String },
        grandTotal: { type: Number, required: true },
        amountPaid: { type: Number, required: true },
        amountDue: { type: Number, required: true, default: 0 },
        loyaltyPointsUsed: { type: Number, default: 0 },
        paymentDetails: [
            {
                method: { type: String, enum: ['Cash', 'Card', 'UPI', 'Wallet', 'Store Credit'], required: true },
                amount: { type: Number, required: true },
                reference: { type: String },
                tenderedAmount: { type: Number },
                changeDue: { type: Number },
            },
        ],
        status: { type: String, enum: ['Pending', 'Completed', 'Cancelled'], default: 'Completed' },
        paymentStatus: { type: String, enum: ['Unpaid', 'Paid', 'Partial'], default: 'Paid' },
        cashier: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    },
    { timestamps: true }
);

OrderSchema.index({ storeId: 1, createdAt: -1 });

OrderSchema.index({ customer: 1 });

export default mongoose.model<IOrder>('Order', OrderSchema);
