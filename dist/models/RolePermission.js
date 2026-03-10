import mongoose, { Schema } from 'mongoose';
const RolePermissionSchema = new Schema({
    role: { type: String, required: true },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store' },
    permissions: [{ type: String }],
    isSystemRole: { type: Boolean, default: false },
}, { timestamps: true });
// Ensure role name is unique per store (or globally if storeId is null)
RolePermissionSchema.index({ role: 1, storeId: 1 }, { unique: true });
export default mongoose.model('RolePermission', RolePermissionSchema);
