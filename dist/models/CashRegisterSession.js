import mongoose, { Schema } from 'mongoose';
const CashRegisterSessionSchema = new Schema({
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
export default mongoose.model('CashRegisterSession', CashRegisterSessionSchema);
