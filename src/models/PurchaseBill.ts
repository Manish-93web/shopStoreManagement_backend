import mongoose, { Schema, Document } from 'mongoose';

export interface IPurchaseBillItem {
    product: mongoose.Types.ObjectId;
    variant?: mongoose.Types.ObjectId;
    name: string;
    hsnCode?: string;
    quantity: number;
    rate: number; // price per unit, before tax
    gstRate: number; // %
    serialNumbers?: string[];
    batchNumber?: string;
    mfgDate?: Date;
    expiryDate?: Date;
    taxable: number;
    cgst: number;
    sgst: number;
    igst: number;
    total: number;
}

// The supplier's tax invoice as entered by the shop. The GST on it is the shop's input tax credit (ITC).
export interface IPurchaseBill extends Document {
    storeId: mongoose.Types.ObjectId;
    supplier: mongoose.Types.ObjectId;
    billNumber: string; // the supplier's invoice number
    billDate: Date;
    supplierGstin?: string;
    isInterState: boolean;
    purchaseOrder?: mongoose.Types.ObjectId;
    items: IPurchaseBillItem[];
    taxableTotal: number;
    cgstTotal: number;
    sgstTotal: number;
    igstTotal: number;
    taxTotal: number;
    roundOff?: number; // added to the total to round it, see Settings -> Bill Rounding
    grandTotal: number;
    stockReceived: boolean; // true when entering the bill also added the stock
    notes?: string;
    createdBy: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const PurchaseBillSchema: Schema = new Schema(
    {
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
    },
    { timestamps: true }
);

// The same supplier cannot have the same invoice number entered twice.
PurchaseBillSchema.index({ storeId: 1, supplier: 1, billNumber: 1 }, { unique: true });
PurchaseBillSchema.index({ storeId: 1, billDate: -1 });

export default mongoose.model<IPurchaseBill>('PurchaseBill', PurchaseBillSchema);
