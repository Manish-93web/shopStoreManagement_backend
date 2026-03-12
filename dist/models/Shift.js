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
    notes: { type: String }
}, {
    timestamps: true
});
export default mongoose.model('Shift', ShiftSchema);
