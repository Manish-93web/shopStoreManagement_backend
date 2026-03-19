import TaxRule from '../models/TaxRule.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/apiResponse.js';
// @desc    Get all tax rules
// @route   GET /api/tax-rules
export const getTaxRules = asyncHandler(async (req, res) => {
    const rules = await TaxRule.find({ storeId: req.tenantId });
    res.status(200).json(new ApiResponse(200, rules));
});
// @desc    Create tax rule
// @route   POST /api/tax-rules
export const createTaxRule = asyncHandler(async (req, res) => {
    const taxRule = await TaxRule.create({ ...req.body, storeId: req.tenantId });
    res.status(201).json(new ApiResponse(201, taxRule, 'Tax rule created'));
});
// @desc    Update tax rule
// @route   PUT /api/tax-rules/:id
export const updateTaxRule = asyncHandler(async (req, res) => {
    const rule = await TaxRule.findOneAndUpdate({ _id: req.params.id, storeId: req.tenantId }, req.body, { returnDocument: 'after' });
    if (!rule)
        return res.status(404).json(new ApiResponse(404, null, 'Tax rule not found'));
    res.status(200).json(new ApiResponse(200, rule, 'Tax rule updated'));
});
