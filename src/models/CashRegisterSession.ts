import mongoose, { Schema, Document } from 'mongoose';

export interface ICashRegisterSession extends Document {
    sessionNumber: string;
    storeId: mongoose.Types.ObjectId;
    cashier: mongoose.Types.ObjectId;
    openingTime: Date;
    closingTime?: Date;
    openingBalance: number;
    closingBalance?: number;
    expectedBalance?: number;
    difference?: number; // Mismatch detection
    transactions: {
        method: 'Cash' | 'Card' | 'UPI' | 'Wallet';
        inflow: number;
        outflow: number;
    }[];
    status: 'Open' | 'Closed';
    notes?: string;
    shiftSummary?: {
        totalSales: number;
        totalOrders: number;
        cashSales: number;
        cardSales: number;
        upiSales: number;
        walletSales: number;
        refunds: number;
    };
    createdAt: Date;
    updatedAt: Date;
}

const CashRegisterSessionSchema: Schema = new Schema({
    sessionNumber: { type: String, required: true, unique: true },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    cashier: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    openingTime: { type: Date, default: Date.now },
    closingTime: { type: Date },
    openingBalance: { type: Number, default: 0 },
    closingBalance: { type: Number },
    expectedBalance: { type: Number },
    difference: { type: Number },
    transactions: [{
        method: { type: String, enum: ['Cash', 'Card', 'UPI', 'Wallet'], required: true },
        inflow: { type: Number, default: 0 },
        outflow: { type: Number, default: 0 }
    }],
    status: { type: String, enum: ['Open', 'Closed'], default: 'Open' },
    notes: { type: String },
    shiftSummary: {
        totalSales: { type: Number, default: 0 },
        totalOrders: { type: Number, default: 0 },
        cashSales: { type: Number, default: 0 },
        cardSales: { type: Number, default: 0 },
        upiSales: { type: Number, default: 0 },
        walletSales: { type: Number, default: 0 },
        refunds: { type: Number, default: 0 }
    }
}, { timestamps: true });

export default mongoose.model<ICashRegisterSession>('CashRegisterSession', CashRegisterSessionSchema);
