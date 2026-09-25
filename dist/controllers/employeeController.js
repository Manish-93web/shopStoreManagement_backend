import User, { UserRole } from '../models/User.js';
import Employee from '../models/Employee.js';
import AuditLog from '../models/AuditLog.js';
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
            return res
                .status(403)
                .json(new ApiResponse(403, null, `User limit reached. Your current plan "${plan.name}" allows up to ${plan.maxUsers} users.`));
        }
    }
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const user = await User.create([
            {
                name,
                email,
                password,
                role: role || UserRole.CASHIER,
                storeId: req.tenantId,
                stores: [req.tenantId],
            },
        ], { session });
        const employee = await Employee.create([
            {
                user: user[0]._id,
                employeeId: `EMP-${Date.now()}`,
                storeId: req.tenantId,
                designation: designation || 'Staff',
                salary: salary || { base: 0, currency: 'INR', frequency: 'Monthly' },
                joiningDate: joiningDate || new Date(),
            },
        ], { session });
        await session.commitTransaction();
        res.status(201).json(new ApiResponse(201, {
            user: user[0],
            employee: employee[0],
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
    const { name, role, isActive, restrictedPermissions } = req.body;
    const update = { name, role, isActive };
    // Only touch this field when the caller actually sent it, so a plain
    // name/role/isActive edit from elsewhere in the app can never accidentally
    // wipe out permission restrictions that were set separately.
    if (restrictedPermissions !== undefined)
        update.restrictedPermissions = restrictedPermissions;
    const employee = await User.findOneAndUpdate({ _id: req.params.id, storeId: req.tenantId }, update, { returnDocument: 'after' }).select('-password -refreshToken');
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
                _id: '$cashier',
                totalSales: { $sum: '$grandTotal' },
                ordersCount: { $sum: 1 },
                averageOrderValue: { $avg: '$grandTotal' },
            },
        },
        {
            $lookup: {
                from: 'users',
                localField: '_id',
                foreignField: '_id',
                as: 'employee',
            },
        },
        { $unwind: '$employee' },
        {
            $project: {
                name: '$employee.name',
                role: '$employee.role',
                totalSales: 1,
                ordersCount: 1,
                averageOrderValue: 1,
            },
        },
        { $sort: { totalSales: -1 } },
    ]);
    res.status(200).json(new ApiResponse(200, metrics, 'Staff performance metrics retrieved'));
});
// @desc    Get a single staff member's full activity trail (logins, and any
//          other action logged against them via AuditLog — sales, inventory
//          adjustments, etc. — as those call sites adopt logAudit) in one
//          query, instead of grepping the store-wide audit log for them.
//          Reuses the existing AuditLog collection; no separate log store.
// @route   GET /api/v1/employees/:id/activity-log
export const getEmployeeActivityLog = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    // Verify the employee belongs to this store before leaking any activity —
    // otherwise a manager could pass an arbitrary user id from another store.
    const employee = await User.findOne({ _id: req.params.id, storeId: req.tenantId }).select('name email role');
    if (!employee) {
        return res.status(404).json(new ApiResponse(404, null, 'Employee not found'));
    }
    const query = { storeId: req.tenantId, userId: employee._id };
    const [logs, total] = await Promise.all([
        AuditLog.find(query)
            .sort({ createdAt: -1 })
            .limit(Number(limit))
            .skip((Number(page) - 1) * Number(limit)),
        AuditLog.countDocuments(query),
    ]);
    res.status(200).json(new ApiResponse(200, {
        employee,
        logs,
        totalPages: Math.ceil(total / Number(limit)),
        currentPage: Number(page),
        total,
    }));
});
