import Supplier from '../models/Supplier.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import SupplierPayment from '../models/SupplierPayment.js';
import AuditLog from '../models/AuditLog.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/apiResponse.js';
// @desc    Get all suppliers for a store
// @route   GET /api/suppliers
export const getSuppliers = asyncHandler(async (req, res) => {
    const suppliers = await Supplier.find({ storeId: req.tenantId }).sort({ name: 1 });
    res.status(200).json(new ApiResponse(200, suppliers));
});
// @desc    Get a single supplier with its purchase order + payment history
// @route   GET /api/suppliers/:id
export const getSupplierById = asyncHandler(async (req, res) => {
    const supplier = await Supplier.findOne({ _id: req.params.id, storeId: req.tenantId });
    if (!supplier) {
        return res.status(404).json(new ApiResponse(404, null, 'Supplier not found'));
    }
    const [purchaseOrders, payments, activityLog] = await Promise.all([
        PurchaseOrder.find({ supplier: supplier._id, storeId: req.tenantId }).sort({ createdAt: -1 }),
        SupplierPayment.find({ supplierId: supplier._id, storeId: req.tenantId }).sort({ createdAt: -1 }),
        AuditLog.find({ storeId: req.tenantId, entity: 'Supplier', entityId: supplier._id })
            .populate('userId', 'name')
            .sort({ createdAt: -1 })
            .limit(20)
    ]);
    res.status(200).json(new ApiResponse(200, { supplier, purchaseOrders, payments, activityLog }));
});
// @desc    Create a supplier
// @route   POST /api/suppliers
export const createSupplier = asyncHandler(async (req, res) => {
    const supplier = await Supplier.create({ ...req.body, storeId: req.tenantId });
    await AuditLog.create({
        userId: req.user?._id,
        storeId: req.tenantId,
        action: 'CREATED_SUPPLIER',
        entity: 'Supplier',
        entityId: supplier._id,
        details: `Supplier "${supplier.name}" added.`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
    });
    res.status(201).json(new ApiResponse(201, supplier, 'Supplier created'));
});
// @desc    Update a supplier
// @route   PUT /api/suppliers/:id
export const updateSupplier = asyncHandler(async (req, res) => {
    const supplier = await Supplier.findOneAndUpdate({ _id: req.params.id, storeId: req.tenantId }, req.body, { returnDocument: 'after' });
    if (!supplier) {
        return res.status(404).json(new ApiResponse(404, null, 'Supplier not found'));
    }
    await AuditLog.create({
        userId: req.user?._id,
        storeId: req.tenantId,
        action: 'UPDATED_SUPPLIER',
        entity: 'Supplier',
        entityId: supplier._id,
        details: `Supplier "${supplier.name}" updated.`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
    });
    res.status(200).json(new ApiResponse(200, supplier, 'Supplier updated'));
});
// @desc    Delete a supplier
// @route   DELETE /api/suppliers/:id
export const deleteSupplier = asyncHandler(async (req, res) => {
    const supplier = await Supplier.findOneAndDelete({ _id: req.params.id, storeId: req.tenantId });
    if (!supplier) {
        return res.status(404).json(new ApiResponse(404, null, 'Supplier not found'));
    }
    await AuditLog.create({
        userId: req.user?._id,
        storeId: req.tenantId,
        action: 'DELETED_SUPPLIER',
        entity: 'Supplier',
        entityId: supplier._id,
        details: `Supplier "${supplier.name}" deleted.`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
    });
    res.status(200).json(new ApiResponse(200, null, 'Supplier deleted'));
});
