import mongoose, { Schema } from 'mongoose';
const WalletSchema = new Schema({
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    storeId: { type: String, required: true, index: true },
    balance: { type: Number, default: 0 },
    transactions: [{
            type: { type: String, enum: ['CREDIT', 'DEBIT'], required: true },
            amount: { type: Number, required: true },
            reason: { type: String, required: true },
            date: { type: Date, default: Date.now }
        }]
}, { timestamps: true });
WalletSchema.index({ customer: 1, storeId: 1 }, { unique: true });
export default mongoose.model('Wallet', WalletSchema);
