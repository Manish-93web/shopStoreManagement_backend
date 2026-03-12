import mongoose, { Schema, Document } from 'mongoose';

export interface IFeatureFlag extends Document {
    key: string;
    name: string;
    description: string;
    isActive: boolean; // Global master kill-switch
    targetPlans: mongoose.Types.ObjectId[]; // Only enabled for these subscription plans
    enabledTenants: mongoose.Types.ObjectId[]; // Specifically whitelisted stores
    disabledTenants: mongoose.Types.ObjectId[]; // Specifically blacklisted stores
    createdAt: Date;
    updatedAt: Date;
}

const FeatureFlagSchema: Schema = new Schema({
    key: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    description: { type: String },
    isActive: { type: Boolean, default: false },
    targetPlans: [{ type: Schema.Types.ObjectId, ref: 'Plan' }],
    enabledTenants: [{ type: Schema.Types.ObjectId, ref: 'Store' }],
    disabledTenants: [{ type: Schema.Types.ObjectId, ref: 'Store' }]
}, { timestamps: true });

export default mongoose.model<IFeatureFlag>('FeatureFlag', FeatureFlagSchema);
