import { Request, Response } from 'express';
import Discount from '../models/Discount.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/apiResponse.js';
import { TenantRequest } from '../middleware/tenantHandler.js';

// @desc    Validate a coupon code
// @route   POST /api/discounts/validate
export const validateDiscount = asyncHandler(async (req: TenantRequest, res: Response) => {
    const { code, amount } = req.body;

    const discount = await Discount.findOne({
        code,
        storeId: req.tenantId,
        isActive: true,
        startDate: { $lte: new Date() },
        endDate: { $gte: new Date() }
    });

    if (!discount) {
        return res.status(404).json(new ApiResponse(404, null, "Invalid or expired coupon"));
    }

    if (amount < (discount.minPurchase || 0)) {
        return res.status(400).json(new ApiResponse(400, null, `Minimum purchase of ₹${discount.minPurchase} required`));
    }

    let discountAmount = 0;
    if (discount.type === 'Percentage') {
        discountAmount = (amount * discount.value) / 100;
        if (discount.maxDiscount && discountAmount > discount.maxDiscount) {
            discountAmount = discount.maxDiscount;
        }
    } else {
        discountAmount = discount.value;
    }

    res.status(200).json(new ApiResponse(200, {
        discountAmount,
        code: discount.code,
        type: discount.type
    }, "Coupon applied"));
});

// @desc    Create a new discount
// @route   POST /api/discounts
export const createDiscount = asyncHandler(async (req: TenantRequest, res: Response) => {
    const discount = await Discount.create({ ...req.body, storeId: req.tenantId });
    res.status(201).json(new ApiResponse(201, discount));
});
