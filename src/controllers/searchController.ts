import { Response } from 'express';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import Customer from '../models/Customer.js';
import Supplier from '../models/Supplier.js';
import User from '../models/User.js';
import { TenantRequest } from '../middleware/tenantHandler.js';
import ApiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

const EMPTY_RESULTS = { products: [], orders: [], customers: [], suppliers: [], employees: [] };

export const globalSearchController = {
    search: asyncHandler(async (req: TenantRequest, res: Response) => {
        const { q } = req.query;
        if (!q) return res.status(200).json(new ApiResponse(200, EMPTY_RESULTS));

        // Escape regex metacharacters — this term reaches RegExp() straight from
        // user input, and an unescaped pattern (e.g. nested quantifiers) can hang
        // the event loop (ReDoS) as well as match unintended things.
        const escaped = (q as string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const searchRegex = new RegExp(escaped, 'i');
        const storeId = req.tenantId;

        const [products, orders, customers, suppliers, employees] = await Promise.all([
            Product.find({ storeId, $or: [{ name: searchRegex }, { sku: searchRegex }] }).limit(5),
            Order.find({ storeId, orderNumber: searchRegex }).limit(5),
            Customer.find({ storeId, $or: [{ name: searchRegex }, { phone: searchRegex }] }).limit(5),
            Supplier.find({ storeId, $or: [{ name: searchRegex }, { phone: searchRegex }] }).limit(5),
            User.find({
                storeId,
                role: { $in: ['STORE_OWNER', 'MANAGER', 'CASHIER', 'INVENTORY_STAFF'] },
                $or: [{ name: searchRegex }, { email: searchRegex }],
            })
                .select('-password -refreshToken')
                .limit(5),
        ]);

        res.status(200).json(
            new ApiResponse(200, {
                products,
                orders,
                customers,
                suppliers,
                employees,
            })
        );
    }),
};
