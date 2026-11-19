import mongoose, { Schema, Document } from 'mongoose';

export interface IPurchaseReturnItem {
    product: mongoose.Types.ObjectId;
    variant?: mongoose.Types.ObjectId;
    name: string;
    hsnCode?: string;
    quantity: number;
    rate: number;
    gstRate: number;
    taxable: number;
    cgst: number;
    sgst: number;
    igst: number;
    total: number;
}

// Goods sent back to a supplier. The debit note is the document that tells the supplier what they owe back.
export interface IPurchaseReturn extends Document {
    storeId: mongoose.Types.ObjectId;
    debitNoteNumber: string;
    supplier: mongoose.Types.ObjectId;
    purchaseBill?: mongoose.Types.ObjectId;
    isInterState: boolean;
    items: IPurchaseReturnItem[];
    taxableTotal: number;
    taxTotal: number;
    grandTotal: number;
    reason?: string;
    createdBy: mongoose.Types.ObjectId;
    createdAt: Date;
}

const PurchaseReturnSchema: Schema = new Schema(
    {
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
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

PurchaseReturnSchema.index({ storeId: 1, debitNoteNumber: 1 }, { unique: true });
PurchaseReturnSchema.index({ storeId: 1, createdAt: -1 });

export default mongoose.model<IPurchaseReturn>('PurchaseReturn', PurchaseReturnSchema);
