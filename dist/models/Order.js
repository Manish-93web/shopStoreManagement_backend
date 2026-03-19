import mongoose, { Schema } from 'mongoose';
const OrderSchema = new Schema({
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
export default mongoose.model('Order', OrderSchema);
