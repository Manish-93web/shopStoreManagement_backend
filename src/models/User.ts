import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export enum UserRole {
    SUPER_ADMIN = 'SUPER_ADMIN',
    STORE_OWNER = 'STORE_OWNER',
    MANAGER = 'MANAGER',
    CASHIER = 'CASHIER',
    INVENTORY_STAFF = 'INVENTORY_STAFF',
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
    // Explicit deny-list, not an allow-list — empty by default so adding this
    // feature never silently takes away access an existing Cashier/Inventory
    // Staff member already had. Only STORE_OWNER can grant/revoke these, and
    // only CASHIER/INVENTORY_STAFF are ever subject to them (MANAGER keeps the
    // same full trust it already has everywhere else in the app).
    restrictedPermissions?: string[];
    // Sidebar-menu allow-list, keyed by the nav item's href (e.g. "/pos",
    // "/inventory"). undefined/unset means no restriction — the user sees
    // every menu their role normally would (fully backward compatible for
    // every existing account). Only meaningful for CASHIER/INVENTORY_STAFF,
    // set by the store owner from the Employees page.
    allowedMenus?: string[];
    refreshToken?: string;
    notificationSettings?: {
        inApp: boolean;
        email: boolean;
        sms: boolean;
        whatsapp: boolean;
    };
    comparePassword(password: string): Promise<boolean>;
}

const UserSchema: Schema = new Schema(
    {
        name: { type: String, required: true },
        email: { type: String, required: true, unique: true },
        phone: { type: String, unique: true, sparse: true },
        password: { type: String },
        role: {
            type: String,
            enum: Object.values(UserRole),
            default: UserRole.STORE_OWNER,
        },
        stores: [{ type: Schema.Types.ObjectId, ref: 'Store' }],
        storeId: { type: Schema.Types.ObjectId, ref: 'Store' },
        isActive: { type: Boolean, default: true },
        restrictedPermissions: [{ type: String }],
        allowedMenus: { type: [String], default: undefined },
        refreshToken: { type: String },
        notificationSettings: {
            inApp: { type: Boolean, default: true },
            email: { type: Boolean, default: true },
            sms: { type: Boolean, default: false },
            whatsapp: { type: Boolean, default: false },
        },
    },
    { timestamps: true }
);

UserSchema.pre<IUser>('save', async function () {
    if (!this.isModified('password')) return;
    this.password = await bcrypt.hash(this.password!, 10);
});

UserSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
    return await bcrypt.compare(password, this.password!);
};

UserSchema.index({ storeId: 1 });

export default mongoose.model<IUser>('User', UserSchema);
