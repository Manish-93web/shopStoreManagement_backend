import mongoose, { Schema, Document } from 'mongoose';

export interface IOTP extends Document {
    phone: string;
    code: string;
    expiresAt: Date;
    createdAt: Date;
}

const OTPSchema: Schema = new Schema({
    phone: { type: String, required: true },
    code: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } } // Document auto-deletes when expiresAt is reached
}, { timestamps: true });

export default mongoose.model<IOTP>('OTP', OTPSchema);
