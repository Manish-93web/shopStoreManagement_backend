import mongoose, { Schema, Document } from 'mongoose';

export interface IAttendance extends Document {
    storeId: mongoose.Types.ObjectId;
    employeeId: mongoose.Types.ObjectId;
    clockIn: Date;
    clockOut?: Date;
    status: 'Present' | 'Late' | 'Absent';
}

const AttendanceSchema: Schema = new Schema({
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    clockIn: { type: Date, required: true },
    clockOut: { type: Date },
    status: { type: String, enum: ['Present', 'Late', 'Absent'], default: 'Present' },
}, { timestamps: true });

export default mongoose.model<IAttendance>('Attendance', AttendanceSchema);
