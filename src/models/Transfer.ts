import mongoose, { Schema, Document } from 'mongoose';

export interface ITransferItem {
    product: mongoose.Types.ObjectId;
    variant: mongoose.Types.ObjectId;
    quantity: number;
}

export interface ITransfer extends Document {
    transferNumber: string;
    fromStore: mongoose.Types.ObjectId;
    toStore: mongoose.Types.ObjectId;
    items: ITransferItem[];
    status: 'Pending' | 'Approved' | 'Shipped' | 'Received' | 'Cancelled';
    createdBy: mongoose.Types.ObjectId;
    approvedBy?: mongoose.Types.ObjectId;
    shippedBy?: mongoose.Types.ObjectId;
    receivedBy?: mongoose.Types.ObjectId;
    approvedAt?: Date;
    shippedAt?: Date;
    receivedAt?: Date;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}

const TransferSchema: Schema = new Schema({
    transferNumber: { type: String, required: true, unique: true },
    fromStore: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    toStore: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    items: [{
        product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
        variant: { type: Schema.Types.ObjectId, ref: 'ProductVariant' },
        quantity: { type: Number, required: true }
    }],
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Shipped', 'Received', 'Cancelled'],
        default: 'Pending'
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    shippedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    receivedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    shippedAt: { type: Date },
    receivedAt: { type: Date },
    notes: { type: String },
}, { timestamps: true });

export default mongoose.model<ITransfer>('Transfer', TransferSchema);
