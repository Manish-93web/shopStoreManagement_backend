import mongoose, { Schema } from 'mongoose';
const EmployeeSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    employeeId: { type: String, required: true, unique: true },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    designation: { type: String, required: true },
    department: { type: String },
    joiningDate: { type: Date, default: Date.now },
    salary: {
        base: { type: Number, required: true },
        currency: { type: String, default: 'INR' },
        frequency: { type: String, enum: ['Daily', 'Weekly', 'Monthly'], default: 'Monthly' }
    },
    bankingInfo: {
        accountName: { type: String },
        accountNumber: { type: String },
        bankName: { type: String },
        branchCode: { type: String }
    },
    commissions: {
        percentage: { type: Number, default: 0 },
        isActive: { type: Boolean, default: false }
    },
    emergencyContact: {
        name: { type: String },
        relation: { type: String },
        phone: { type: String }
    },
    documents: [{
            name: { type: String },
            url: { type: String }
        }],
    status: { type: String, enum: ['Active', 'On Leave', 'Terminated'], default: 'Active' },
}, { timestamps: true });
export default mongoose.model('Employee', EmployeeSchema);
