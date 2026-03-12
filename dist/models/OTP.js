import mongoose, { Schema } from 'mongoose';
const OTPSchema = new Schema({
    phone: { type: String, required: true },
    code: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } } // Document auto-deletes when expiresAt is reached
}, { timestamps: true });
export default mongoose.model('OTP', OTPSchema);
