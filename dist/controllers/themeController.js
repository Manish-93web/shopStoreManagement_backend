import ThemeConfig from '../models/ThemeConfig.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/apiResponse.js';
// @desc    Get theme config for current tenant
// @route   GET /api/theme
export const getTheme = asyncHandler(async (req, res) => {
    const theme = await ThemeConfig.findOne({ storeId: req.tenantId });
    if (!theme) {
        // Return defaults if no theme set yet
        return res.status(200).json(new ApiResponse(200, {
            primaryColor: '#6366f1',
            accentColor: '#8b5cf6',
            backgroundColor: '#0f0f1a',
            textColor: '#f8fafc',
            brandName: 'RetailSync',
            fontFamily: 'Inter',
            borderRadius: '0.75rem'
        }));
    }
    res.status(200).json(new ApiResponse(200, theme));
});
// @desc    Save / update theme config for current tenant
// @route   PUT /api/theme
export const saveTheme = asyncHandler(async (req, res) => {
    const { primaryColor, accentColor, backgroundColor, textColor, logoUrl, brandName, fontFamily, borderRadius } = req.body;
    const theme = await ThemeConfig.findOneAndUpdate({ storeId: req.tenantId }, { primaryColor, accentColor, backgroundColor, textColor, logoUrl, brandName, fontFamily, borderRadius, storeId: req.tenantId }, { upsert: true, new: true, runValidators: true });
    res.status(200).json(new ApiResponse(200, theme, 'Theme saved successfully'));
});
