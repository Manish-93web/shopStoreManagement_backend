import mongoose, { Schema, Document } from 'mongoose';

export const MOVEMENT_TYPES = [
    'OPENING',
    'PURCHASE',
    'PURCHASE_RETURN',
    'SALE',
    'SALE_CANCEL',
    'SALE_RETURN',
    'EXCHANGE',
    'ADJUSTMENT',
    'STOCK_COUNT',
    'TRANSFER_OUT',
    'TRANSFER_IN',
    'CONVERT_OUT',
    'CONVERT_IN',
] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

// One row for every change to a product's stock, so a product's full history is in a single place.
export interface IStockMovement extends Document {
    storeId: mongoose.Types.ObjectId;
    product: mongoose.Types.ObjectId;
    variant?: mongoose.Types.ObjectId;
    type: MovementType;
    quantity: number; // signed: + stock in, - stock out
    balanceAfter?: number; // stock on hand right after this movement
    reference?: string; // human readable: order number, PO number, bill number...
    referenceId?: mongoose.Types.ObjectId;
    notes?: string;
    createdBy?: mongoose.Types.ObjectId;
    createdAt: Date;
}

const StockMovementSchema: Schema = new Schema(
    {
        storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
        product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
        variant: { type: Schema.Types.ObjectId, ref: 'ProductVariant' },
        type: { type: String, enum: MOVEMENT_TYPES, required: true },
        quantity: { type: Number, required: true },
        balanceAfter: { type: Number },
        reference: { type: String },
        referenceId: { type: Schema.Types.ObjectId },
        notes: { type: String },
        createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

StockMovementSchema.index({ storeId: 1, product: 1, createdAt: -1 });
StockMovementSchema.index({ storeId: 1, createdAt: -1 });

export default mongoose.model<IStockMovement>('StockMovement', StockMovementSchema);
