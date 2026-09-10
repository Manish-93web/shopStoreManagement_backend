import { Response } from 'express';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import Customer from '../models/Customer.js';
import { TenantRequest } from '../middleware/tenantHandler.js';
import ApiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

export const globalSearchController = {
    search: asyncHandler(async (req: TenantRequest, res: Response) => {
        const { q } = req.query;
        if (!q) return res.status(200).json(new ApiResponse(200, { products: [], orders: [], customers: [] }));

        const searchRegex = new RegExp(q as string, 'i');
        const storeId = req.tenantId;

        const [products, orders, customers] = await Promise.all([
            Product.find({ storeId, $or: [{ name: searchRegex }, { sku: searchRegex }] }).limit(5),
            Order.find({ storeId, orderNumber: searchRegex }).limit(5),
            Customer.find({ storeId, $or: [{ name: searchRegex }, { phone: searchRegex }] }).limit(5),
        ]);

        res.status(200).json(
            new ApiResponse(200, {
                products,
                orders,
                customers,
            })
        );
    }),
};
