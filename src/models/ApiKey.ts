import mongoose, { Schema, Document } from 'mongoose';

export interface IApiKey extends Document {
    name: string;
    keyHash: string;
    prefix: string; // First 4-8 chars for identification in UI
    tenantId: string;
    permissions: string[];
    isActive: boolean;
    lastUsedAt?: Date;
    usageCount: number;
    createdAt: Date;
    updatedAt: Date;
}

const ApiKeySchema: Schema = new Schema(
    {
        name: { type: String, required: true },
        keyHash: { type: String, required: true, select: false }, // Never return hash natively
        prefix: { type: String, required: true },
        tenantId: { type: String, required: true, index: true },
        permissions: { type: [String], default: ['read:all'] },
        isActive: { type: Boolean, default: true },
        lastUsedAt: { type: Date },
        usageCount: { type: Number, default: 0 },
    },
    { timestamps: true }
);

export default mongoose.model<IApiKey>('ApiKey', ApiKeySchema);
