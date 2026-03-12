import SupplierPayment from '../models/SupplierPayment.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/apiResponse.js';
// @desc    Get all payments for a supplier
// @route   GET /api/supplier-payments/supplier/:supplierId
export const getSupplierPayments = asyncHandler(async (req, res) => {
    const payments = await SupplierPayment.find({
        supplierId: req.params.supplierId,
        storeId: req.tenantId
    }).sort({ paymentDate: -1 });
    res.status(200).json(new ApiResponse(200, payments));
});
// @desc    Record a supplier payment
// @route   POST /api/supplier-payments
export const createSupplierPayment = asyncHandler(async (req, res) => {
    const paymentData = {
        ...req.body,
        storeId: req.tenantId,
        createdBy: req.user._id
    };
    const payment = await SupplierPayment.create(paymentData);
    // If payment is linked to a PO, we could potentially update PO payment status here
    // For now, just recording the transaction
    res.status(201).json(new ApiResponse(201, payment, "Payment recorded successfully"));
});
// @desc    Get all payments (admin/manager view)
// @route   GET /api/supplier-payments
export const getAllSupplierPayments = asyncHandler(async (req, res) => {
    const payments = await SupplierPayment.find({ storeId: req.tenantId })
        .populate('supplierId', 'name')
        .sort({ createdAt: -1 });
    res.status(200).json(new ApiResponse(200, payments));
});
