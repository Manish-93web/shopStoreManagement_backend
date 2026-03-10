import mongoose, { Schema, Document } from 'mongoose';

export interface IReturnItem {
    product: mongoose.Types.ObjectId;
    variant?: mongoose.Types.ObjectId;
    name: string;
    quantity: number;
    price: number;
    tax: number;
    reason: string;
    condition: 'Good' | 'Damaged' | 'Opened';
}

export interface IReturnOrder extends Document {
    returnNumber: string;
    originalOrder: mongoose.Types.ObjectId;
    storeId: mongoose.Types.ObjectId;
    customer?: mongoose.Types.ObjectId;
    items: IReturnItem[];
    subTotal: number;
    taxTotal: number;
    grandTotal: number;
    refundAmount: number;
    refundStatus: 'Pending' | 'Processed' | 'Failed';
    status: 'Received' | 'Inspected' | 'Completed' | 'Cancelled';
    receivedBy: mongoose.Types.ObjectId;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}

const ReturnOrderSchema: Schema = new Schema({
    returnNumber: { type: String, required: true, unique: true },
    originalOrder: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer' },
    items: [{
        product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
        variant: { type: Schema.Types.ObjectId, ref: 'ProductVariant' },
        name: { type: String, required: true },
        quantity: { type: Number, required: true },
        price: { type: Number, required: true },
        tax: { type: Number, default: 0 },
        reason: { type: String, required: true },
        condition: { type: String, enum: ['Good', 'Damaged', 'Opened'], default: 'Good' }
    }],
    subTotal: { type: Number, required: true },
    taxTotal: { type: Number, required: true },
    grandTotal: { type: Number, required: true },
    refundAmount: { type: Number, required: true },
    refundStatus: { type: String, enum: ['Pending', 'Processed', 'Failed'], default: 'Pending' },
    status: { type: String, enum: ['Received', 'Inspected', 'Completed', 'Cancelled'], default: 'Received' },
    receivedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    notes: { type: String },
}, { timestamps: true });

export default mongoose.model<IReturnOrder>('ReturnOrder', ReturnOrderSchema);
