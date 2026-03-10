import mongoose, { Schema } from 'mongoose';
const NotificationSchema = new Schema({
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['INFO', 'WARNING', 'ERROR', 'SUCCESS'], default: 'INFO' },
    title: { type: String, required: true },
    message: { type: String, required: true },
    actionUrl: { type: String },
    isRead: { type: Boolean, default: false },
    channels: [{
            type: String,
            enum: ['In-App', 'Email', 'SMS', 'WhatsApp'],
            default: ['In-App']
        }],
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    metadata: { type: Schema.Types.Mixed },
}, { timestamps: true });
export default mongoose.model('Notification', NotificationSchema);
