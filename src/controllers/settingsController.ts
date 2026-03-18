import { Response } from 'express';
import Settings from '../models/Settings.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/apiResponse.js';
import { TenantRequest } from '../middleware/tenantHandler.js';

// @desc    Get store settings
// @route   GET /api/settings
export const getSettings = asyncHandler(async (req: TenantRequest, res: Response) => {
    let settings = await Settings.findOne({ storeId: req.tenantId });
    if (!settings) {
        settings = await Settings.create({ storeId: req.tenantId });
    }
    res.status(200).json(new ApiResponse(200, settings));
});

// @desc    Update store settings
// @route   PUT /api/settings
export const updateSettings = asyncHandler(async (req: TenantRequest, res: Response) => {
    const settings = await Settings.findOneAndUpdate(
        { storeId: req.tenantId },
        req.body,
        { returnDocument: 'after', upsert: true }
    );
    res.status(200).json(new ApiResponse(200, settings, 'Settings updated'));
});
