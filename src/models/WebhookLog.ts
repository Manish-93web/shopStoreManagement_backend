import mongoose, { Schema, Document } from 'mongoose';

export interface IWebhookLog extends Document {
    webhookId: mongoose.Types.ObjectId;
    event: string;
    payload: any;
    responseCode?: number;
    responseBody?: string;
    status: 'success' | 'failed';
    errorMessage?: string;
    attempt: number;
    tenantId: string;
    createdAt: Date;
}

const WebhookLogSchema: Schema = new Schema({
    webhookId: { type: Schema.Types.ObjectId, ref: 'Webhook', required: true, index: true },
    event: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    responseCode: { type: Number },
    responseBody: { type: String },
    status: { type: String, enum: ['success', 'failed'], required: true },
    errorMessage: { type: String },
    attempt: { type: Number, default: 1 },
    tenantId: { type: String, required: true, index: true },
}, { timestamps: true });

export default mongoose.model<IWebhookLog>('WebhookLog', WebhookLogSchema);
