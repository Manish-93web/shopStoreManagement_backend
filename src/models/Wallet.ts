import mongoose, { Schema, Document } from 'mongoose';

export interface IWallet extends Document {
    customer: mongoose.Types.ObjectId;
    storeId: string;
    balance: number;
    transactions: {
        type: 'CREDIT' | 'DEBIT';
        amount: number;
        reason: string;
        date: Date;
    }[];
}

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

export default mongoose.model<IWallet>('Wallet', WalletSchema);
