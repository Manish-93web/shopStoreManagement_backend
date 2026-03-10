import mongoose, { Schema, Document } from 'mongoose';

export interface IRolePermission extends Document {
    role: string;
    storeId?: mongoose.Types.ObjectId; // Optional: Override per store
    permissions: string[];
    isSystemRole: boolean; // Cannot delete standard roles
    createdAt: Date;
    updatedAt: Date;
}

const RolePermissionSchema: Schema = new Schema({
    role: { type: String, required: true },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store' },
    permissions: [{ type: String }],
    isSystemRole: { type: Boolean, default: false },
}, { timestamps: true });

// Ensure role name is unique per store (or globally if storeId is null)
RolePermissionSchema.index({ role: 1, storeId: 1 }, { unique: true });

export default mongoose.model<IRolePermission>('RolePermission', RolePermissionSchema);
