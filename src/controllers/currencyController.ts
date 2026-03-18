import { Response } from 'express';
import { TenantRequest } from '../middleware/tenantHandler.js';
import ApiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import Currency from '../models/Currency.js';

export const currencyController = {
    getCurrencies: asyncHandler(async (req: TenantRequest, res: Response) => {
        const currencies = await Currency.find({ storeId: req.tenantId });
        res.status(200).json(new ApiResponse(200, currencies));
    }),

    createCurrency: asyncHandler(async (req: TenantRequest, res: Response) => {
        const currency = await Currency.create({ ...req.body, storeId: req.tenantId });
        res.status(201).json(new ApiResponse(201, currency));
    }),

    updateCurrency: asyncHandler(async (req: TenantRequest, res: Response) => {
        const currency = await Currency.findOneAndUpdate(
            { _id: req.params.id, storeId: req.tenantId },
            req.body,
            { returnDocument: 'after' }
        );
        res.status(200).json(new ApiResponse(200, currency));
    })
};
