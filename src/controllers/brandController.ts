import { Response } from 'express';
import Brand from '../models/Brand.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/apiResponse.js';
import { TenantRequest } from '../middleware/tenantHandler.js';

// @desc    Get all brands
// @route   GET /api/brands
export const getBrands = asyncHandler(async (req: TenantRequest, res: Response) => {
    const brands = await Brand.find({ storeId: req.tenantId });
    res.status(200).json(new ApiResponse(200, brands));
});

// @desc    Create brand
// @route   POST /api/brands
export const createBrand = asyncHandler(async (req: TenantRequest, res: Response) => {
    const { name, description, logo } = req.body;
    const brand = await Brand.create({
        name,
        description,
        logo,
        storeId: req.tenantId
    });
    res.status(201).json(new ApiResponse(201, brand, 'Brand created'));
});

// @desc    Update brand
// @route   PUT /api/brands/:id
export const updateBrand = asyncHandler(async (req: TenantRequest, res: Response) => {
    const brand = await Brand.findOneAndUpdate(
        { _id: req.params.id, storeId: req.tenantId },
        req.body,
        { returnDocument: 'after' }
    );
    if (!brand) return res.status(404).json(new ApiResponse(404, null, 'Brand not found'));
    res.status(200).json(new ApiResponse(200, brand, 'Brand updated'));
});

// @desc    Delete brand
// @route   DELETE /api/brands/:id
export const deleteBrand = asyncHandler(async (req: TenantRequest, res: Response) => {
    const brand = await Brand.findOneAndDelete({ _id: req.params.id, storeId: req.tenantId });
    if (!brand) return res.status(404).json(new ApiResponse(404, null, 'Brand not found'));
    res.status(200).json(new ApiResponse(200, null, 'Brand deleted'));
});
