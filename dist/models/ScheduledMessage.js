import mongoose, { Schema } from 'mongoose';
const ScheduledMessageSchema = new Schema({
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    order: { type: Schema.Types.ObjectId, ref: 'Order' },
    templateLabel: { type: String, required: true },
    language: { type: String, enum: ['en', 'hi', 'hinglish'], default: 'en' },
    message: { type: String, required: true },
    phone: { type: String, required: true },
    scheduledFor: { type: Date, required: true },
    status: { type: String, enum: ['Pending', 'Due', 'Sent', 'Cancelled'], default: 'Pending' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    sentAt: { type: Date },
}, { timestamps: true });
ScheduledMessageSchema.index({ storeId: 1, status: 1, scheduledFor: 1 });
export default mongoose.model('ScheduledMessage', ScheduledMessageSchema);
