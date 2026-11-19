import mongoose, { Schema, Document } from 'mongoose';

export interface ISettings extends Document {
    storeId: mongoose.Types.ObjectId;
    currency: {
        code: string; // e.g., INR
        symbol: string; // e.g., ₹
    };
    taxConfig: {
        defaultTaxRate: number;
        taxSystem: 'GST' | 'VAT' | 'SalesTax';
        roundingMode: 'none' | 'nearest' | 'up' | 'down'; // How the bill total is rounded to a whole rupee
    };
    receiptConfig: {
        header?: string;
        footer?: string;
        showLogo: boolean;
        thermalWidth: '58mm' | '80mm';
    };
    notificationConfig: {
        lowStockThreshold: number;
        enableEmail: boolean;
        enableSMS: boolean;
    };
    archiveConfig: {
        autoArchiveEnabled: boolean;
        orderRetentionMonths: number;
        notificationRetentionDays: number;
        auditLogRetentionMonths: number;
    };
    inventoryConfig: {
        allowNegativeStock: boolean; // false = billing is blocked when stock is not enough
        cashierCanAdjustStock: boolean; // Cashiers may adjust stock by hand
        managersCanChangePrice: boolean; // false = only the owner may change prices (selling, MRP, cost)
        adjustmentApprovalThreshold: number; // Manager adjustments larger than this need the owner's approval (0 = off)
    };
    timezone: string;
    language: string;
    createdAt: Date;
    updatedAt: Date;
}

const SettingsSchema: Schema = new Schema(
    {
        storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true, unique: true },
        currency: {
            code: { type: String, default: 'INR' },
            symbol: { type: String, default: '₹' },
        },
        timezone: { type: String, default: 'UTC' },
        language: { type: String, default: 'en' },
        taxConfig: {
            defaultTaxRate: { type: Number, default: 0 },
            taxSystem: { type: String, enum: ['GST', 'VAT', 'SalesTax'], default: 'GST' },
            roundingMode: { type: String, enum: ['none', 'nearest', 'up', 'down'], default: 'none' },
        },
        receiptConfig: {
            header: { type: String },
            footer: { type: String },
            showLogo: { type: Boolean, default: true },
            thermalWidth: { type: String, enum: ['58mm', '80mm'], default: '80mm' },
        },
        notificationConfig: {
            lowStockThreshold: { type: Number, default: 10 },
            enableEmail: { type: Boolean, default: true },
            enableSMS: { type: Boolean, default: false },
        },
        inventoryConfig: {
            allowNegativeStock: { type: Boolean, default: true },
            cashierCanAdjustStock: { type: Boolean, default: false },
            managersCanChangePrice: { type: Boolean, default: true },
            adjustmentApprovalThreshold: { type: Number, default: 0 },
        },
        archiveConfig: {
            autoArchiveEnabled: { type: Boolean, default: false },
            orderRetentionMonths: { type: Number, default: 24 },
            notificationRetentionDays: { type: Number, default: 30 },
            auditLogRetentionMonths: { type: Number, default: 6 },
        },
    },
    { timestamps: true }
);

export default mongoose.model<ISettings>('Settings', SettingsSchema);
