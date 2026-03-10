import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export enum UserRole {
    SUPER_ADMIN = 'SUPER_ADMIN',
    STORE_OWNER = 'STORE_OWNER',
    MANAGER = 'MANAGER',
    CASHIER = 'CASHIER',
    INVENTORY_STAFF = 'INVENTORY_STAFF'
}

export interface IUser extends Document {
    name: string;
    email: string;
    phone?: string;
    password?: string;
    role: UserRole;
    stores: mongoose.Types.ObjectId[]; // For STORE_OWNER
    storeId?: mongoose.Types.ObjectId; // For staff members
    isActive: boolean;
    refreshToken?: string;
    comparePassword(password: string): Promise<boolean>;
}

const UserSchema: Schema = new Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String },
    password: { type: String },
    role: {
        type: String,
        enum: Object.values(UserRole),
        default: UserRole.STORE_OWNER
    },
    stores: [{ type: Schema.Types.ObjectId, ref: 'Store' }],
    storeId: { type: Schema.Types.ObjectId, ref: 'Store' },
    isActive: { type: Boolean, default: true },
    refreshToken: { type: String },
}, { timestamps: true });

UserSchema.pre<IUser>('save', async function () {
    if (!this.isModified('password')) return;
    this.password = await bcrypt.hash(this.password!, 10);
});

UserSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
    return await bcrypt.compare(password, this.password!);
};

export default mongoose.model<IUser>('User', UserSchema);
