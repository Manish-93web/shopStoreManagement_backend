import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
export var UserRole;
(function (UserRole) {
    UserRole["SUPER_ADMIN"] = "SUPER_ADMIN";
    UserRole["STORE_OWNER"] = "STORE_OWNER";
    UserRole["MANAGER"] = "MANAGER";
    UserRole["CASHIER"] = "CASHIER";
    UserRole["INVENTORY_STAFF"] = "INVENTORY_STAFF";
})(UserRole || (UserRole = {}));
const UserSchema = new Schema({
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
    notificationSettings: {
        inApp: { type: Boolean, default: true },
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: false },
        whatsapp: { type: Boolean, default: false },
    },
}, { timestamps: true });
UserSchema.pre('save', async function () {
    if (!this.isModified('password'))
        return;
    this.password = await bcrypt.hash(this.password, 10);
});
UserSchema.methods.comparePassword = async function (password) {
    return await bcrypt.compare(password, this.password);
};
UserSchema.index({ email: 1 });
UserSchema.index({ storeId: 1 });
export default mongoose.model('User', UserSchema);
