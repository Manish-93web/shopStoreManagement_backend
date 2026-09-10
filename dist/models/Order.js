import mongoose, { Schema } from 'mongoose';
const OrderSchema = new Schema({
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
    discountTotal: { type: Number, default: 0 },
    discountReason: { type: String },
    grandTotal: { type: Number, required: true },
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
}, { timestamps: true });
OrderSchema.index({ storeId: 1, createdAt: -1 });
OrderSchema.index({ customer: 1 });
export default mongoose.model('Order', OrderSchema);
