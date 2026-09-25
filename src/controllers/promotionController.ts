import { Response } from 'express';
import { TenantRequest } from '../middleware/tenantHandler.js';
import ApiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { promotionService } from '../services/promotionService.js';
import Coupon from '../models/Coupon.js';
import PromotionRule from '../models/PromotionRule.js';

export const promotionController = {
    // @desc    Validate coupon for POS
    validate: asyncHandler(async (req: TenantRequest, res: Response) => {
        const { code, cartTotal, cartItems, customerId } = req.body;
        try {
            const result = await promotionService.validateCoupon(
                code,
                cartTotal,
                cartItems || [],
                customerId,
                req.tenantId as any
            );
            res.status(200).json(new ApiResponse(200, result, 'Coupon valid'));
        } catch (error: any) {
            res.status(400).json(new ApiResponse(400, null, error.message));
        }
    }),

    // @desc    Get applicable auto-promotions
    getAutoPromotions: asyncHandler(async (req: TenantRequest, res: Response) => {
        const { cartTotal, cartItems } = req.body;
        const result = await promotionService.evaluateAutomaticPromotions(
            cartTotal,
            cartItems || [],
            req.tenantId as any
        );
        res.status(200).json(new ApiResponse(200, result));
    }),

    // CRUD for Coupons
    getCoupons: asyncHandler(async (req: TenantRequest, res: Response) => {
        const search = (req.query.search as string)?.trim();
        const isActive = (req.query.isActive as string)?.trim();
        const startDate = req.query.startDate as string;
        const endDate = req.query.endDate as string;

        const query: any = { storeId: req.tenantId };
        if (search) query.code = { $regex: search, $options: 'i' };
        if (isActive === 'true') query.isActive = true;
        else if (isActive === 'false') query.isActive = false;
        if (startDate && endDate) {
            // "Validity" range = coupons whose [validFrom, validTo] window overlaps
            // the selected range, i.e. coupons that were valid at some point in it.
            query.validFrom = { $lte: new Date(endDate) };
            query.validTo = { $gte: new Date(startDate) };
        }

        const coupons = await Coupon.find(query).sort({ createdAt: -1 });
        res.status(200).json(new ApiResponse(200, coupons));
    }),

    createCoupon: asyncHandler(async (req: TenantRequest, res: Response) => {
        const coupon = await Coupon.create({ ...req.body, storeId: req.tenantId });
        res.status(201).json(new ApiResponse(201, coupon, 'Coupon created'));
    }),

    // CRUD for Rules
    getRules: asyncHandler(async (req: TenantRequest, res: Response) => {
        const search = (req.query.search as string)?.trim();
        const isActive = (req.query.isActive as string)?.trim();
        const triggerType = (req.query.triggerType as string)?.trim();

        const query: any = { storeId: req.tenantId };
        if (search) query.name = { $regex: search, $options: 'i' };
        if (isActive === 'true') query.isActive = true;
        else if (isActive === 'false') query.isActive = false;
        if (triggerType) query.triggerType = triggerType;

        const rules = await PromotionRule.find(query).sort({ priority: -1 });
        res.status(200).json(new ApiResponse(200, rules));
    }),

    createRule: asyncHandler(async (req: TenantRequest, res: Response) => {
        const rule = await PromotionRule.create({ ...req.body, storeId: req.tenantId });
        res.status(201).json(new ApiResponse(201, rule, 'Rule created'));
    }),
};
