import { Response } from 'express';
import TaxRule from '../models/TaxRule.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/apiResponse.js';
import { TenantRequest } from '../middleware/tenantHandler.js';

// @desc    Get all tax rules
// @route   GET /api/tax-rules
export const getTaxRules = asyncHandler(async (req: TenantRequest, res: Response) => {
    const rules = await TaxRule.find({ storeId: req.tenantId });
    res.status(200).json(new ApiResponse(200, rules));
});

// @desc    Create tax rule
// @route   POST /api/tax-rules
export const createTaxRule = asyncHandler(async (req: TenantRequest, res: Response) => {
    const taxRule = await TaxRule.create({ ...req.body, storeId: req.tenantId });
    res.status(201).json(new ApiResponse(201, taxRule, 'Tax rule created'));
});

// @desc    Update tax rule
// @route   PUT /api/tax-rules/:id
export const updateTaxRule = asyncHandler(async (req: TenantRequest, res: Response) => {
    const rule = await TaxRule.findOneAndUpdate(
        { _id: req.params.id, storeId: req.tenantId },
        req.body,
        { new: true }
    );
    if (!rule) return res.status(404).json(new ApiResponse(404, null, 'Tax rule not found'));
    res.status(200).json(new ApiResponse(200, rule, 'Tax rule updated'));
});
