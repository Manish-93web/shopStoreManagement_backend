import mongoose, { Schema } from 'mongoose';
const ShiftSchema = new Schema({
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    startTime: { type: Date, required: true, default: Date.now },
    endTime: { type: Date },
    status: { type: String, enum: ['Open', 'Closed'], default: 'Open' },
    startingCash: { type: Number, required: true, default: 0 },
    expectedCash: { type: Number, default: 0 },
    actualCash: { type: Number },
    discrepancy: { type: Number },
    totalCardSales: { type: Number, default: 0 },
    totalCashSales: { type: Number, default: 0 },
    totalUpiSales: { type: Number, default: 0 },
    totalWalletSales: { type: Number, default: 0 },
    totalRefunds: { type: Number, default: 0 },
    notes: { type: String }
}, {
    timestamps: true
});
ShiftSchema.index({ storeId: 1, status: 1 });
ShiftSchema.index({ storeId: 1, userId: 1, status: 1 });
export default mongoose.model('Shift', ShiftSchema);
