import mongoose, { Schema, Document } from 'mongoose';

export interface IReport extends Document {
    storeId: mongoose.Types.ObjectId;
    type: 'sales' | 'inventory' | 'profit' | 'tax' | 'customer' | 'revenue';
    status: 'pending' | 'processing' | 'completed' | 'failed';
    format: 'excel' | 'pdf' | 'csv';
    filters: Record<string, any>;
    fileUrl?: string;
    error?: string;
    generatedBy: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const reportSchema = new Schema<IReport>({
    storeId: {
        type: Schema.Types.ObjectId,
        ref: 'Store',
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: ['sales', 'inventory', 'profit', 'tax', 'customer', 'revenue'],
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed'],
        default: 'pending'
    },
    format: {
        type: String,
        enum: ['excel', 'pdf', 'csv'],
        required: true
    },
    filters: {
        type: Schema.Types.Mixed,
        default: {}
    },
    fileUrl: {
        type: String
    },
    error: {
        type: String
    },
    generatedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

const Report = mongoose.model<IReport>('Report', reportSchema);

export default Report;
