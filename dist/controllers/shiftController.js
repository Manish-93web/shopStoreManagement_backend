import Shift from '../models/Shift.js';
import Order from '../models/Order.js';
import RefundTransaction from '../models/RefundTransaction.js';
import CashRegisterSession from '../models/CashRegisterSession.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/apiResponse.js';
// Helper to calculate shift totals, broken out per payment method (matches
// the granularity the now-deprecated CashRegisterSession used to track) plus
// refunds processed during the window — needed for a real cash-mismatch and
// payment-reconciliation report, not just a single "cash vs card" split.
const calculateShiftTotals = async (storeId, userId, startTime, endTime = new Date()) => {
    const [orders, refunds] = await Promise.all([
        Order.find({
            storeId,
            cashier: userId,
            createdAt: { $gte: startTime, $lte: endTime },
            status: 'Completed',
        }),
        RefundTransaction.find({
            storeId,
            processedBy: userId,
            status: 'Completed',
            createdAt: { $gte: startTime, $lte: endTime },
        }),
    ]);
    let cashSales = 0;
    let cardSales = 0;
    let upiSales = 0;
    let walletSales = 0;
    orders.forEach((order) => {
        order.paymentDetails.forEach((payment) => {
            if (payment.method === 'Cash')
                cashSales += payment.amount;
            else if (payment.method === 'UPI')
                upiSales += payment.amount;
            else if (payment.method === 'Wallet')
                walletSales += payment.amount;
            else
                cardSales += payment.amount;
        });
    });
    const totalRefunds = refunds.reduce((sum, r) => sum + r.amount, 0);
    return { cashSales, cardSales, upiSales, walletSales, totalRefunds };
};
// A cashier who had an open CashRegisterSession (the now-deprecated parallel
// model) at the moment this consolidation shipped would otherwise be stuck —
// checkout now gates on Shift, but they never opened one. This transparently
// carries their already-open register over into a real Shift, once, and
// closes out the legacy record so it stops being double-counted anywhere.
const migrateLegacySessionIfAny = async (storeId, userId) => {
    const legacy = await CashRegisterSession.findOne({ storeId, cashier: userId, status: 'Open' });
    if (!legacy)
        return null;
    const shift = await Shift.create({
        storeId,
        userId,
        startTime: legacy.openingTime,
        startingCash: legacy.openingBalance,
        expectedCash: legacy.openingBalance,
        status: 'Open',
        notes: `Migrated from legacy register session ${legacy.sessionNumber}`,
    });
    legacy.status = 'Closed';
    legacy.closingTime = new Date();
    legacy.notes = [legacy.notes, `Auto-migrated to unified Shift ${shift._id}`].filter(Boolean).join(' | ');
    await legacy.save();
    return shift;
};
// @desc    Start a new shift
// @route   POST /api/v1/shifts/start
export const startShift = asyncHandler(async (req, res) => {
    const { startingCash, notes } = req.body;
    const userId = req.user._id;
    // Check if user already has an open shift
    const existingOpenShift = await Shift.findOne({ storeId: req.tenantId, userId, status: 'Open' });
    if (existingOpenShift) {
        return res
            .status(400)
            .json(new ApiResponse(400, null, 'You already have an open shift. Please close it first.'));
    }
    const shift = await Shift.create({
        storeId: req.tenantId,
        userId,
        startingCash: startingCash || 0,
        expectedCash: startingCash || 0,
        status: 'Open',
        startTime: new Date(),
        notes,
    });
    res.status(201).json(new ApiResponse(201, shift, 'Shift started successfully'));
});
// @desc    Get current active shift
// @route   GET /api/v1/shifts/active
export const getActiveShift = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    let shift = await Shift.findOne({ storeId: req.tenantId, userId, status: 'Open' });
    if (!shift) {
        shift = await migrateLegacySessionIfAny(req.tenantId, userId.toString());
    }
    if (!shift) {
        return res.status(200).json(new ApiResponse(200, null, 'No active shift found'));
    }
    // Calculate real-time totals
    const { cashSales, cardSales, upiSales, walletSales, totalRefunds } = await calculateShiftTotals(req.tenantId, userId.toString(), shift.startTime);
    // Virtual expected cash = starting cash + cash sales
    const currentExpectedCash = shift.startingCash + cashSales;
    res.status(200).json(new ApiResponse(200, {
        ...shift.toObject(),
        totalCashSales: cashSales,
        totalCardSales: cardSales,
        totalUpiSales: upiSales,
        totalWalletSales: walletSales,
        totalRefunds,
        expectedCash: currentExpectedCash,
    }));
});
// @desc    Close current shift
// @route   POST /api/v1/shifts/close
export const closeShift = asyncHandler(async (req, res) => {
    const { actualCash, notes } = req.body;
    const userId = req.user._id;
    const shift = await Shift.findOne({ storeId: req.tenantId, userId, status: 'Open' });
    if (!shift) {
        return res.status(404).json(new ApiResponse(404, null, 'No open shift found to close'));
    }
    const endTime = new Date();
    const { cashSales, cardSales, upiSales, walletSales, totalRefunds } = await calculateShiftTotals(req.tenantId, userId.toString(), shift.startTime, endTime);
    const expectedCash = shift.startingCash + cashSales;
    const discrepancy = actualCash - expectedCash;
    shift.endTime = endTime;
    shift.status = 'Closed';
    shift.totalCashSales = cashSales;
    shift.totalCardSales = cardSales;
    shift.totalUpiSales = upiSales;
    shift.totalWalletSales = walletSales;
    shift.totalRefunds = totalRefunds;
    shift.expectedCash = expectedCash;
    shift.actualCash = actualCash;
    shift.discrepancy = discrepancy;
    shift.notes = notes;
    await shift.save();
    res.status(200).json(new ApiResponse(200, shift, 'Shift closed successfully'));
});
// @desc    Get all shifts (Admin)
// @route   GET /api/v1/shifts
export const getAllShifts = asyncHandler(async (req, res) => {
    const shifts = await Shift.find({ storeId: req.tenantId })
        .populate('userId', 'name email role')
        .sort({ createdAt: -1 });
    res.status(200).json(new ApiResponse(200, shifts));
});
