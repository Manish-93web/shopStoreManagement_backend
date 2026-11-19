import mongoose, { Schema } from 'mongoose';
const PurchaseReturnSchema = new Schema({
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    debitNoteNumber: { type: String, required: true },
    supplier: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true },
    purchaseBill: { type: Schema.Types.ObjectId, ref: 'PurchaseBill' },
    isInterState: { type: Boolean, default: false },
    items: [
        {
            product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
            variant: { type: Schema.Types.ObjectId, ref: 'ProductVariant' },
            name: { type: String, required: true },
            hsnCode: { type: String },
            quantity: { type: Number, required: true },
            rate: { type: Number, required: true },
            gstRate: { type: Number, default: 0 },
            taxable: { type: Number, required: true },
            cgst: { type: Number, default: 0 },
            sgst: { type: Number, default: 0 },
            igst: { type: Number, default: 0 },
            total: { type: Number, required: true },
        },
    ],
    taxableTotal: { type: Number, required: true },
    taxTotal: { type: Number, default: 0 },
    grandTotal: { type: Number, required: true },
    reason: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: { createdAt: true, updatedAt: false } });
PurchaseReturnSchema.index({ storeId: 1, debitNoteNumber: 1 }, { unique: true });
PurchaseReturnSchema.index({ storeId: 1, createdAt: -1 });
export default mongoose.model('PurchaseReturn', PurchaseReturnSchema);
