import mongoose, { Schema, Document } from 'mongoose';

export interface IShift extends Document {
    storeId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    startTime: Date;
    endTime?: Date;
    status: 'Open' | 'Closed';
    startingCash: number;
    expectedCash: number;
    actualCash?: number;
    discrepancy?: number;
    totalCardSales: number;
    totalCashSales: number;
    totalUpiSales: number;
    totalWalletSales: number;
    totalRefunds: number;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}

const ShiftSchema: Schema = new Schema(
    {
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
        notes: { type: String },
    },
    {
        timestamps: true,
    }
);

ShiftSchema.index({ storeId: 1, status: 1 });
ShiftSchema.index({ storeId: 1, userId: 1, status: 1 });

export default mongoose.model<IShift>('Shift', ShiftSchema);
