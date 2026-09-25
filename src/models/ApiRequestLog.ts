import mongoose, { Schema, Document } from 'mongoose';

// Real usage analytics for the public API — previously an API key only ever
// showed lastUsedAt (a single timestamp), no request volume, no per-endpoint
// breakdown, nothing an integration owner could actually use to debug or
// monitor their usage.
export interface IApiRequestLog extends Document {
    apiKeyId: mongoose.Types.ObjectId;
    tenantId: string;
    method: string;
    path: string;
    statusCode: number;
    createdAt: Date;
}

const ApiRequestLogSchema: Schema = new Schema(
    {
        apiKeyId: { type: Schema.Types.ObjectId, ref: 'ApiKey', required: true },
        tenantId: { type: String, required: true, index: true },
        method: { type: String, required: true },
        path: { type: String, required: true },
        statusCode: { type: Number, required: true },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

ApiRequestLogSchema.index({ apiKeyId: 1, createdAt: -1 });

export default mongoose.model<IApiRequestLog>('ApiRequestLog', ApiRequestLogSchema);
