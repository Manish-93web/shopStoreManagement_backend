import mongoose, { Schema, Document } from 'mongoose';

// A stock adjustment that is waiting for the owner's approval because it is larger than the allowed limit.
export interface IAdjustmentRequest extends Document {
    storeId: mongoose.Types.ObjectId;
    product: mongoose.Types.ObjectId;
    quantity: number; // signed: + adds stock, - removes it
    reason: string;
    notes?: string;
    status: 'Pending' | 'Approved' | 'Rejected';
    requestedBy: mongoose.Types.ObjectId;
    decidedBy?: mongoose.Types.ObjectId;
    decidedAt?: Date;
    createdAt: Date;
}

const AdjustmentRequestSchema: Schema = new Schema(
    {
        storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
        product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
        quantity: { type: Number, required: true },
        reason: { type: String, required: true },
        notes: { type: String },
        status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
        requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        decidedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        decidedAt: { type: Date },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

AdjustmentRequestSchema.index({ storeId: 1, status: 1, createdAt: -1 });

export default mongoose.model<IAdjustmentRequest>('AdjustmentRequest', AdjustmentRequestSchema);
