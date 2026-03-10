import mongoose, { Schema } from 'mongoose';
const ExchangeOrderSchema = new Schema({
    exchangeNumber: { type: String, required: true, unique: true },
    returnOrder: { type: Schema.Types.ObjectId, ref: 'ReturnOrder', required: true },
    originalOrder: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    newOrder: { type: Schema.Types.ObjectId, ref: 'Order' },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    exchangedItems: [{
            returnedProduct: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
            returnedVariant: { type: Schema.Types.ObjectId, ref: 'ProductVariant' },
            newProduct: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
            newVariant: { type: Schema.Types.ObjectId, ref: 'ProductVariant' },
            quantity: { type: Number, required: true },
            priceDifference: { type: Number, required: true }
        }],
    status: { type: String, enum: ['Draft', 'Processed', 'Completed', 'Cancelled'], default: 'Draft' },
}, { timestamps: true });
export default mongoose.model('ExchangeOrder', ExchangeOrderSchema);
