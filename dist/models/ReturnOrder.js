import mongoose, { Schema } from 'mongoose';
const ReturnOrderSchema = new Schema({
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
export default mongoose.model('ReturnOrder', ReturnOrderSchema);
