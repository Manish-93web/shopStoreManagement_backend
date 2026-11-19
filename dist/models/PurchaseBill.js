import mongoose, { Schema } from 'mongoose';
const PurchaseBillSchema = new Schema({
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    supplier: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true },
    billNumber: { type: String, required: true, trim: true },
    billDate: { type: Date, required: true },
    supplierGstin: { type: String, trim: true, uppercase: true },
    isInterState: { type: Boolean, default: false },
    purchaseOrder: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder' },
    items: [
        {
            product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
            variant: { type: Schema.Types.ObjectId, ref: 'ProductVariant' },
            name: { type: String, required: true },
            hsnCode: { type: String },
            quantity: { type: Number, required: true },
            rate: { type: Number, required: true },
            gstRate: { type: Number, default: 0 },
            serialNumbers: [{ type: String }],
            batchNumber: { type: String },
            mfgDate: { type: Date },
            expiryDate: { type: Date },
            taxable: { type: Number, required: true },
            cgst: { type: Number, default: 0 },
            sgst: { type: Number, default: 0 },
            igst: { type: Number, default: 0 },
            total: { type: Number, required: true },
        },
    ],
    taxableTotal: { type: Number, required: true },
    cgstTotal: { type: Number, default: 0 },
    sgstTotal: { type: Number, default: 0 },
    igstTotal: { type: Number, default: 0 },
    taxTotal: { type: Number, default: 0 },
    roundOff: { type: Number, default: 0 },
    grandTotal: { type: Number, required: true },
    stockReceived: { type: Boolean, default: false },
    notes: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });
// The same supplier cannot have the same invoice number entered twice.
PurchaseBillSchema.index({ storeId: 1, supplier: 1, billNumber: 1 }, { unique: true });
PurchaseBillSchema.index({ storeId: 1, billDate: -1 });
export default mongoose.model('PurchaseBill', PurchaseBillSchema);
