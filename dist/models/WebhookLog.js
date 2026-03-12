import mongoose, { Schema } from 'mongoose';
const WebhookLogSchema = new Schema({
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
export default mongoose.model('WebhookLog', WebhookLogSchema);
