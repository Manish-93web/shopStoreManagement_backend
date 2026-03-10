import mongoose, { Schema } from 'mongoose';
const AttendanceSchema = new Schema({
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    clockIn: { type: Date, required: true },
    clockOut: { type: Date },
    status: { type: String, enum: ['Present', 'Late', 'Absent'], default: 'Present' },
}, { timestamps: true });
export default mongoose.model('Attendance', AttendanceSchema);
