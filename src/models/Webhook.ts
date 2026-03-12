import mongoose, { Schema, Document } from 'mongoose';

export interface IWebhook extends Document {
    url: string;
    events: string[];
    secret: string;
    isActive: boolean;
    tenantId: string;
    storeId?: string;
    createdAt: Date;
    updatedAt: Date;
}

const WebhookSchema: Schema = new Schema({
    url: { type: String, required: true },
    events: { type: [String], required: true },
    secret: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    tenantId: { type: String, required: true, index: true },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store' },
}, { timestamps: true });

export default mongoose.model<IWebhook>('Webhook', WebhookSchema);
