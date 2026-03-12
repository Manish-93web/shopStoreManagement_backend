import mongoose, { Schema } from 'mongoose';
const CurrencySchema = new Schema({
    code: { type: String, required: true, uppercase: true },
    symbol: { type: String, required: true },
    name: { type: String, required: true },
    exchangeRate: { type: Number, required: true, default: 1 },
    isBase: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true }
}, { timestamps: true });
CurrencySchema.index({ code: 1, storeId: 1 }, { unique: true });
export default mongoose.model('Currency', CurrencySchema);
