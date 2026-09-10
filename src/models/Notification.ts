import mongoose, { Schema, Document } from 'mongoose';

export interface INotification extends Document {
    recipient: mongoose.Types.ObjectId;
    type: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';
    title: string;
    message: string;
    actionUrl?: string;
    isRead: boolean;
    channels: ('In-App' | 'Email' | 'SMS' | 'WhatsApp')[];
    deliveryStatus?: { channel: 'In-App' | 'Email' | 'SMS' | 'WhatsApp'; success: boolean }[];
    storeId: mongoose.Types.ObjectId;
    metadata?: any;
    createdAt: Date;
    updatedAt: Date;
}

const NotificationSchema: Schema = new Schema(
    {
        recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        type: { type: String, enum: ['INFO', 'WARNING', 'ERROR', 'SUCCESS'], default: 'INFO' },
        title: { type: String, required: true },
        message: { type: String, required: true },
        actionUrl: { type: String },
        isRead: { type: Boolean, default: false },
        channels: [
            {
                type: String,
                enum: ['In-App', 'Email', 'SMS', 'WhatsApp'],
                default: ['In-App'],
            },
        ],
        deliveryStatus: [
            {
                channel: { type: String, enum: ['In-App', 'Email', 'SMS', 'WhatsApp'] },
                success: { type: Boolean },
                _id: false,
            },
        ],
        storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: false },
        metadata: { type: Schema.Types.Mixed },
    },
    { timestamps: true }
);

export default mongoose.model<INotification>('Notification', NotificationSchema);
