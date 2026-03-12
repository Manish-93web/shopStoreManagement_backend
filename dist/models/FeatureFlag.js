import mongoose, { Schema } from 'mongoose';
const FeatureFlagSchema = new Schema({
    key: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    description: { type: String },
    isActive: { type: Boolean, default: false },
    targetPlans: [{ type: Schema.Types.ObjectId, ref: 'Plan' }],
    enabledTenants: [{ type: Schema.Types.ObjectId, ref: 'Store' }],
    disabledTenants: [{ type: Schema.Types.ObjectId, ref: 'Store' }]
}, { timestamps: true });
export default mongoose.model('FeatureFlag', FeatureFlagSchema);
