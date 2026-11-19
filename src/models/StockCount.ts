import mongoose, { Schema, Document } from 'mongoose';

export interface IStockCountItem {
    product: mongoose.Types.ObjectId;
    variant?: mongoose.Types.ObjectId;
    name: string;
    sku?: string;
    unit?: string;
    systemQty: number; // what the software said when the count was started
    countedQty?: number; // what staff actually counted (unset until counted)
    difference?: number; // countedQty - systemQty, filled when completed
}

export interface IStockCount extends Document {
    storeId: mongoose.Types.ObjectId;
    countNumber: string;
    title?: string;
    status: 'Draft' | 'Completed';
    items: IStockCountItem[];
    notes?: string;
    createdBy: mongoose.Types.ObjectId;
    completedBy?: mongoose.Types.ObjectId;
    completedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const StockCountSchema: Schema = new Schema(
    {
        storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
        countNumber: { type: String, required: true },
        title: { type: String },
        status: { type: String, enum: ['Draft', 'Completed'], default: 'Draft' },
        items: [
            {
                product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
                variant: { type: Schema.Types.ObjectId, ref: 'ProductVariant' },
                name: { type: String, required: true },
                sku: { type: String },
                unit: { type: String },
                systemQty: { type: Number, required: true },
                countedQty: { type: Number },
                difference: { type: Number },
            },
        ],
        notes: { type: String },
        createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        completedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        completedAt: { type: Date },
    },
    { timestamps: true }
);

StockCountSchema.index({ storeId: 1, countNumber: 1 }, { unique: true });

export default mongoose.model<IStockCount>('StockCount', StockCountSchema);
