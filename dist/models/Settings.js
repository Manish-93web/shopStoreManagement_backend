import mongoose, { Schema } from 'mongoose';
const SettingsSchema = new Schema({
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true, unique: true },
    currency: {
        code: { type: String, default: 'INR' },
        symbol: { type: String, default: '₹' }
    },
    timezone: { type: String, default: 'UTC' },
    language: { type: String, default: 'en' },
    taxConfig: {
        defaultTaxRate: { type: Number, default: 0 },
        taxSystem: { type: String, enum: ['GST', 'VAT', 'SalesTax'], default: 'GST' }
    },
    receiptConfig: {
        header: { type: String },
        footer: { type: String },
        showLogo: { type: Boolean, default: true },
        thermalWidth: { type: String, enum: ['58mm', '80mm'], default: '80mm' }
    },
    notificationConfig: {
        lowStockThreshold: { type: Number, default: 10 },
        enableEmail: { type: Boolean, default: true },
        enableSMS: { type: Boolean, default: false }
    }
}, { timestamps: true });
export default mongoose.model('Settings', SettingsSchema);
