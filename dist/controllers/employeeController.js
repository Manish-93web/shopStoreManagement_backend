import User, { UserRole } from '../models/User.js';
import Employee from '../models/Employee.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/apiResponse.js';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Store from '../models/Store.js';
// @desc    Get all employees for a store
// @route   GET /api/employees
export const getEmployees = asyncHandler(async (req, res) => {
    const scopedRoles = [UserRole.MANAGER, UserRole.CASHIER, UserRole.STORE_OWNER];
    const role = req.query.role?.trim();
    const isActiveParam = req.query.isActive?.trim();
    const query = {
        storeId: req.tenantId,
        role: { $in: scopedRoles },
    };
    // Only honor a role filter if it's one of the roles this endpoint already scopes to.
    if (role && scopedRoles.includes(role)) {
        query.role = role;
    }
    if (isActiveParam === 'true' || isActiveParam === 'false') {
        query.isActive = isActiveParam === 'true';
    }
    const employees = await User.find(query).select('-password -refreshToken');
    res.status(200).json(new ApiResponse(200, employees));
});
// @desc    Create a new employee (add user to store)
// @route   POST /api/employees
export const createEmployee = asyncHandler(async (req, res) => {
    const { name, email, password, role, designation, salary, joiningDate } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        return res.status(400).json(new ApiResponse(400, null, 'Email already in use'));
    }
    // Check Plan Limits
    const store = await Store.findById(req.tenantId).populate('subscriptionPlan');
    if (store && store.subscriptionPlan) {
        const plan = store.subscriptionPlan;
        const currentCount = await User.countDocuments({ storeId: req.tenantId });
        if (plan.maxUsers !== 0 && currentCount >= plan.maxUsers) {
            return res.status(403).json(new ApiResponse(403, null, `User limit reached. Your current plan "${plan.name}" allows up to ${plan.maxUsers} users.`));
        }
    }
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const user = await User.create([{
                name,
                email,
                password,
                role: role || UserRole.CASHIER,
                storeId: req.tenantId,
                stores: [req.tenantId]
            }], { session });
        const employee = await Employee.create([{
                user: user[0]._id,
                employeeId: `EMP-${Date.now()}`,
                storeId: req.tenantId,
                designation: designation || 'Staff',
                salary: salary || { base: 0, currency: 'INR', frequency: 'Monthly' },
                joiningDate: joiningDate || new Date()
            }], { session });
        await session.commitTransaction();
        res.status(201).json(new ApiResponse(201, {
            user: user[0],
            employee: employee[0]
        }, 'Employee created successfully'));
    }
    catch (error) {
        await session.abortTransaction();
        res.status(500).json(new ApiResponse(500, null, error.message));
    }
    finally {
        session.endSession();
    }
});
// @desc    Update employee details
// @route   PUT /api/employees/:id
export const updateEmployee = asyncHandler(async (req, res) => {
    const { name, role, isActive } = req.body;
    const employee = await User.findOneAndUpdate({ _id: req.params.id, storeId: req.tenantId }, { name, role, isActive }, { returnDocument: 'after' }).select('-password -refreshToken');
    if (!employee) {
        return res.status(404).json(new ApiResponse(404, null, 'Employee not found'));
    }
    res.status(200).json(new ApiResponse(200, employee, 'Employee updated'));
});
// @desc    Remove employee from store
// @route   DELETE /api/employees/:id
export const deleteEmployee = asyncHandler(async (req, res) => {
    const employee = await User.findOneAndDelete({ _id: req.params.id, storeId: req.tenantId });
    if (!employee) {
        return res.status(404).json(new ApiResponse(404, null, 'Employee not found'));
    }
    res.status(200).json(new ApiResponse(200, null, 'Employee removed'));
});
// @desc    Get staff performance metrics
// @route   GET /api/employees/performance
export const getStaffPerformance = asyncHandler(async (req, res) => {
    const metrics = await Order.aggregate([
        { $match: { storeId: new mongoose.Types.ObjectId(req.tenantId), status: 'Completed' } },
        {
            $group: {
                _id: "$cashier",
                totalSales: { $sum: "$grandTotal" },
                ordersCount: { $sum: 1 },
                averageOrderValue: { $avg: "$grandTotal" }
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "_id",
                foreignField: "_id",
                as: "employee"
            }
        },
        { $unwind: "$employee" },
        {
            $project: {
                name: "$employee.name",
                role: "$employee.role",
                totalSales: 1,
                ordersCount: 1,
                averageOrderValue: 1
            }
        },
        { $sort: { totalSales: -1 } }
    ]);
    res.status(200).json(new ApiResponse(200, metrics, "Staff performance metrics retrieved"));
});
