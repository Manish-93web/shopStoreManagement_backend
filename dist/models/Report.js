import mongoose, { Schema } from 'mongoose';
const reportSchema = new Schema({
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
const Report = mongoose.model('Report', reportSchema);
export default Report;
