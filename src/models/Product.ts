import mongoose, { Schema, Document } from 'mongoose';
import { UNIT_CODES } from '../utils/units.js';

export interface IVariant {
    name: string; // e.g., Size, Color
    options: string[]; // e.g., ['S', 'M', 'L'], ['Red', 'Blue']
}

export interface IProduct extends Document {
    name: string;
    sku: string;
    barcode: string;
    category: mongoose.Types.ObjectId;
    subCategory?: mongoose.Types.ObjectId; // A child of `category`
    brand?: mongoose.Types.ObjectId; // Changed to ref
    description?: string;
    price: number;
    costPrice: number;
    mrp?: number; // Maximum retail price printed on the product
    taxRate: number;
    taxRule?: mongoose.Types.ObjectId; // Optional reusable tax category; falls back to the flat taxRate above when unset
    hsnCode?: string;
    unit: string; // Unit of measure, see utils/units.ts
    location?: string; // Rack / shelf / bin
    trackBatch: boolean; // Batch + expiry tracked (medicine, food): expired stock is not sold
    composition?: string; // Salt / ingredients
    drugSchedule?: string; // e.g. H, H1, X, OTC
    trackSerial: boolean; // Each unit has a serial / IMEI that must be entered when selling
    warrantyMonths?: number;
    isCombo: boolean; // A bundle: selling it takes stock from its components
    comboItems: { product: mongoose.Types.ObjectId; quantity: number }[];
    altBarcodes: string[]; // Other barcodes that sell this same product (old/new packing, pack sizes)
    lastPurchasePrice?: number;
    lastPurchaseDate?: Date;
    lastSupplier?: mongoose.Types.ObjectId;
    isActive: boolean; // Inactive (archived) products are hidden from billing but stay on old bills
    images: string[];
    hasVariants: boolean;
    storeId: mongoose.Types.ObjectId; // Multi-tenancy (Owner's main account)
    createdAt: Date;
    updatedAt: Date;
}

const ProductSchema: Schema = new Schema(
    {
        name: { type: String, required: true },
        sku: { type: String, required: true },
        barcode: { type: String, required: true },
        category: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
        subCategory: { type: Schema.Types.ObjectId, ref: 'Category' },
        brand: { type: Schema.Types.ObjectId, ref: 'Brand' },
        description: { type: String },
        price: { type: Number, required: true },
        costPrice: { type: Number, default: 0 },
        mrp: { type: Number },
        taxRate: { type: Number, default: 0 },
        taxRule: { type: Schema.Types.ObjectId, ref: 'TaxRule' },
        hsnCode: { type: String },
        unit: { type: String, enum: UNIT_CODES, default: 'pcs' },
        altBarcodes: [{ type: String }],
        location: { type: String, trim: true },
        trackBatch: { type: Boolean, default: false },
        composition: { type: String, trim: true },
        drugSchedule: { type: String, trim: true },
        trackSerial: { type: Boolean, default: false },
        warrantyMonths: { type: Number },
        isCombo: { type: Boolean, default: false },
        comboItems: [
            {
                product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
                quantity: { type: Number, required: true, min: 0 },
                _id: false,
            },
        ],
        lastPurchasePrice: { type: Number },
        lastPurchaseDate: { type: Date },
        lastSupplier: { type: Schema.Types.ObjectId, ref: 'Supplier' },
        isActive: { type: Boolean, default: true },
        images: [{ type: String }],
        hasVariants: { type: Boolean, default: false },
        storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    },
    { timestamps: true }
);

// Compound indexes to allow same SKU/Barcode across different stores/tenants
ProductSchema.index({ storeId: 1, sku: 1 }, { unique: true });
ProductSchema.index({ storeId: 1, barcode: 1 }, { unique: true });
ProductSchema.index({ storeId: 1, altBarcodes: 1 }, { partialFilterExpression: { altBarcodes: { $type: 'string' } } });

// Real text index for whole/prefix-word search (e.g. a future public catalog page).
// productController.getProducts deliberately keeps its existing regex-based search as
// the primary query mechanism for the inventory search bar — a text index structurally
// can't accelerate arbitrary mid-string matches (e.g. typing a barcode fragment), which
// the current substring search correctly supports; switching to $text there would
// regress that UX rather than "back" it.
ProductSchema.index({ name: 'text', sku: 'text', barcode: 'text', description: 'text' });

export default mongoose.model<IProduct>('Product', ProductSchema);
