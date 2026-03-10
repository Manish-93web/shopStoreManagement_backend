import { Response } from 'express';
import Attendance from '../models/Attendance.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/apiResponse.js';
import { TenantRequest } from '../middleware/tenantHandler.js';

// @desc    Clock In
// @route   POST /api/attendance/clock-in
export const clockIn = asyncHandler(async (req: TenantRequest, res: Response) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await Attendance.findOne({
        employeeId: req.user._id,
        storeId: req.tenantId,
        clockIn: { $gte: today }
    });

    if (existing && existing.clockIn && !existing.clockOut) {
        return res.status(400).json(new ApiResponse(400, null, 'Already clocked in for today'));
    }

    const record = await Attendance.create({
        employeeId: req.user._id,
        storeId: req.tenantId,
        clockIn: new Date(),
        status: 'Present'
    });

    res.status(201).json(new ApiResponse(201, record, 'Clocked in successfully'));
});

// @desc    Clock Out
// @route   PATCH /api/attendance/clock-out
export const clockOut = asyncHandler(async (req: TenantRequest, res: Response) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const record = await Attendance.findOne({
        employeeId: req.user._id,
        storeId: req.tenantId,
        clockIn: { $gte: today },
        clockOut: { $exists: false }
    });

    if (!record) {
        return res.status(400).json(new ApiResponse(400, null, 'No active clock-in session found'));
    }

    record.clockOut = new Date();
    await record.save();

    res.status(200).json(new ApiResponse(200, record, 'Clocked out successfully'));
});

// @desc    Get attendance records
// @route   GET /api/attendance
export const getAttendance = asyncHandler(async (req: TenantRequest, res: Response) => {
    const { employeeId, from, to } = req.query;
    const query: any = { storeId: req.tenantId };

    if (employeeId) query.employeeId = employeeId;
    if (from && to) {
        query.clockIn = { $gte: new Date(from as string), $lte: new Date(to as string) };
    }

    const records = await Attendance.find(query)
        .populate('employeeId', 'name email')
        .sort({ clockIn: -1 });

    res.status(200).json(new ApiResponse(200, records));
});
