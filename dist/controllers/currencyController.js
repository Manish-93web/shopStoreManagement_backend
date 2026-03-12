import ApiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import Currency from '../models/Currency.js';
export const currencyController = {
    getCurrencies: asyncHandler(async (req, res) => {
        const currencies = await Currency.find({ storeId: req.tenantId });
        res.status(200).json(new ApiResponse(200, currencies));
    }),
    createCurrency: asyncHandler(async (req, res) => {
        const currency = await Currency.create({ ...req.body, storeId: req.tenantId });
        res.status(201).json(new ApiResponse(201, currency));
    }),
    updateCurrency: asyncHandler(async (req, res) => {
        const currency = await Currency.findOneAndUpdate({ _id: req.params.id, storeId: req.tenantId }, req.body, { new: true });
        res.status(200).json(new ApiResponse(200, currency));
    })
};
