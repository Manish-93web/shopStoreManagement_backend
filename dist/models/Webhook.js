import mongoose, { Schema } from 'mongoose';
const WebhookSchema = new Schema({
    url: { type: String, required: true },
    events: { type: [String], required: true },
    secret: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    tenantId: { type: String, required: true, index: true },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store' },
}, { timestamps: true });
export default mongoose.model('Webhook', WebhookSchema);
