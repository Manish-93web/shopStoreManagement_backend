import mongoose, { Schema, Document } from 'mongoose';

export interface IOrderItem {
    product: mongoose.Types.ObjectId;
    name: string;
    quantity: number;
    price: number;
    tax: number;
    discount: number;
    total: number;
}

export interface IPayment {
    method: 'Cash' | 'Card' | 'UPI' | 'Wallet';
    amount: number;
    transactionId?: string;
}

export interface IPaymentDetail {
    method: 'Cash' | 'Card' | 'UPI' | 'Wallet';
    amount: number;
}

export interface IOrder extends Document {
    orderNumber: string;
    storeId: mongoose.Types.ObjectId;
    customer?: mongoose.Types.ObjectId;
    items: IOrderItem[];
    subTotal: number;
    taxTotal: number;
    discountTotal: number;
    grandTotal: number;
    loyaltyPointsUsed?: number;
    paymentDetails: IPaymentDetail[];
    status: 'Pending' | 'Completed' | 'Cancelled';
    paymentStatus: 'Unpaid' | 'Paid' | 'Partial';
    cashier: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const OrderSchema: Schema = new Schema({
    orderNumber: { type: String, required: true, unique: true },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer' },
    items: [{
        product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
        name: { type: String, required: true },
        quantity: { type: Number, required: true },
        price: { type: Number, required: true },
        tax: { type: Number, default: 0 },
        discount: { type: Number, default: 0 },
        total: { type: Number, required: true }
    }],
    subTotal: { type: Number, required: true },
    taxTotal: { type: Number, required: true },
    discountTotal: { type: Number, default: 0 },
    grandTotal: { type: Number, required: true },
    loyaltyPointsUsed: { type: Number, default: 0 },
    paymentDetails: [{
        method: { type: String, enum: ['Cash', 'Card', 'UPI', 'Wallet'], required: true },
        amount: { type: Number, required: true }
    }],
    status: { type: String, enum: ['Pending', 'Completed', 'Cancelled'], default: 'Completed' },
    paymentStatus: { type: String, enum: ['Unpaid', 'Paid', 'Partial'], default: 'Paid' },
    cashier: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

OrderSchema.index({ storeId: 1, createdAt: -1 });

OrderSchema.index({ customer: 1 });

export default mongoose.model<IOrder>('Order', OrderSchema);
