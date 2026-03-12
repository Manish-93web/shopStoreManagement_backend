import Shift from '../models/Shift.js';
import Order from '../models/Order.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/apiResponse.js';
// Helper to calculate shift totals
const calculateShiftTotals = async (storeId, userId, startTime, endTime = new Date()) => {
    const orders = await Order.find({
        storeId,
        cashier: userId,
        createdAt: { $gte: startTime, $lte: endTime },
        status: 'Completed'
    });
    let cashSales = 0;
    let cardSales = 0;
    orders.forEach(order => {
        order.paymentDetails.forEach(payment => {
            if (payment.method === 'Cash') {
                cashSales += payment.amount;
            }
            else {
                cardSales += payment.amount;
            }
        });
    });
    return { cashSales, cardSales };
};
// @desc    Start a new shift
// @route   POST /api/v1/shifts/start
export const startShift = asyncHandler(async (req, res) => {
    const { startingCash } = req.body;
    const userId = req.user._id;
    // Check if user already has an open shift
    const existingOpenShift = await Shift.findOne({ storeId: req.tenantId, userId, status: 'Open' });
    if (existingOpenShift) {
        return res.status(400).json(new ApiResponse(400, null, "You already have an open shift. Please close it first."));
    }
    const shift = await Shift.create({
        storeId: req.tenantId,
        userId,
        startingCash: startingCash || 0,
        expectedCash: startingCash || 0,
        status: 'Open',
        startTime: new Date()
    });
    res.status(201).json(new ApiResponse(201, shift, "Shift started successfully"));
});
// @desc    Get current active shift
// @route   GET /api/v1/shifts/active
export const getActiveShift = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const shift = await Shift.findOne({ storeId: req.tenantId, userId, status: 'Open' });
    if (!shift) {
        return res.status(200).json(new ApiResponse(200, null, "No active shift found"));
    }
    // Calculate real-time totals
    const { cashSales, cardSales } = await calculateShiftTotals(req.tenantId, userId.toString(), shift.startTime);
    // Virtual expected cash = starting cash + cash sales
    const currentExpectedCash = shift.startingCash + cashSales;
    res.status(200).json(new ApiResponse(200, {
        ...shift.toObject(),
        totalCashSales: cashSales,
        totalCardSales: cardSales,
        expectedCash: currentExpectedCash
    }));
});
// @desc    Close current shift
// @route   POST /api/v1/shifts/close
export const closeShift = asyncHandler(async (req, res) => {
    const { actualCash, notes } = req.body;
    const userId = req.user._id;
    const shift = await Shift.findOne({ storeId: req.tenantId, userId, status: 'Open' });
    if (!shift) {
        return res.status(404).json(new ApiResponse(404, null, "No open shift found to close"));
    }
    const endTime = new Date();
    const { cashSales, cardSales } = await calculateShiftTotals(req.tenantId, userId.toString(), shift.startTime, endTime);
    const expectedCash = shift.startingCash + cashSales;
    const discrepancy = actualCash - expectedCash;
    shift.endTime = endTime;
    shift.status = 'Closed';
    shift.totalCashSales = cashSales;
    shift.totalCardSales = cardSales;
    shift.expectedCash = expectedCash;
    shift.actualCash = actualCash;
    shift.discrepancy = discrepancy;
    shift.notes = notes;
    await shift.save();
    res.status(200).json(new ApiResponse(200, shift, "Shift closed successfully"));
});
// @desc    Get all shifts (Admin)
// @route   GET /api/v1/shifts
export const getAllShifts = asyncHandler(async (req, res) => {
    const shifts = await Shift.find({ storeId: req.tenantId })
        .populate('userId', 'name email role')
        .sort({ createdAt: -1 });
    res.status(200).json(new ApiResponse(200, shifts));
});
