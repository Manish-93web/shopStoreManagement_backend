import { Response } from 'express';
import Supplier from '../models/Supplier.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/apiResponse.js';
import { TenantRequest } from '../middleware/tenantHandler.js';

// @desc    Get all suppliers for a store
// @route   GET /api/suppliers
export const getSuppliers = asyncHandler(async (req: TenantRequest, res: Response) => {
    const suppliers = await Supplier.find({ storeId: req.tenantId }).sort({ name: 1 });
    res.status(200).json(new ApiResponse(200, suppliers));
});

// @desc    Create a supplier
// @route   POST /api/suppliers
export const createSupplier = asyncHandler(async (req: TenantRequest, res: Response) => {
    const supplier = await Supplier.create({ ...req.body, storeId: req.tenantId });
    res.status(201).json(new ApiResponse(201, supplier, 'Supplier created'));
});

// @desc    Update a supplier
// @route   PUT /api/suppliers/:id
export const updateSupplier = asyncHandler(async (req: TenantRequest, res: Response) => {
    const supplier = await Supplier.findOneAndUpdate(
        { _id: req.params.id, storeId: req.tenantId },
        req.body,
        { returnDocument: 'after' }
    );
    if (!supplier) {
        return res.status(404).json(new ApiResponse(404, null, 'Supplier not found'));
    }
    res.status(200).json(new ApiResponse(200, supplier, 'Supplier updated'));
});

// @desc    Delete a supplier
// @route   DELETE /api/suppliers/:id
export const deleteSupplier = asyncHandler(async (req: TenantRequest, res: Response) => {
    const supplier = await Supplier.findOneAndDelete({ _id: req.params.id, storeId: req.tenantId });
    if (!supplier) {
        return res.status(404).json(new ApiResponse(404, null, 'Supplier not found'));
    }
    res.status(200).json(new ApiResponse(200, null, 'Supplier deleted'));
});
