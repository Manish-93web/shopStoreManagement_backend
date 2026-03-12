import mongoose, { Schema, Document } from 'mongoose';

export interface ICurrency extends Document {
    code: string; // e.g. USD, EUR, INR
    symbol: string; // e.g. $, €, ₹
    name: string;
    exchangeRate: number; // Rate relative to base currency (e.g. 1 USD = 83 INR)
    isBase: boolean;
    isActive: boolean;
    storeId: mongoose.Types.ObjectId;
}

const CurrencySchema: Schema = new Schema({
    code: { type: String, required: true, uppercase: true },
    symbol: { type: String, required: true },
    name: { type: String, required: true },
    exchangeRate: { type: Number, required: true, default: 1 },
    isBase: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true }
}, { timestamps: true });

CurrencySchema.index({ code: 1, storeId: 1 }, { unique: true });

export default mongoose.model<ICurrency>('Currency', CurrencySchema);
