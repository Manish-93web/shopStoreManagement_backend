import Product from '../models/Product.js';
import Inventory from '../models/Inventory.js';
import ApiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import mongoose from 'mongoose';
export const importController = {
    // @desc    Import products from JSON/CSV data
    // @route   POST /api/import/products
    importProducts: asyncHandler(async (req, res) => {
        const { products } = req.body;
        if (!Array.isArray(products))
            return res.status(400).json(new ApiResponse(400, null, "Invalid data format"));
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            const storeId = req.tenantId;
            const importedProducts = [];
            for (const pData of products) {
                const product = new Product({
                    ...pData,
                    storeId
                });
                await product.save({ session });
                const inventory = new Inventory({
                    product: product._id,
                    store: storeId,
                    quantity: pData.initialStock || 0
                });
                await inventory.save({ session });
                importedProducts.push(product);
            }
            await session.commitTransaction();
            res.status(201).json(new ApiResponse(201, { count: importedProducts.length }, "Products imported successfully"));
        }
        catch (error) {
            await session.abortTransaction();
            res.status(500).json(new ApiResponse(500, null, error.message));
        }
        finally {
            session.endSession();
        }
    })
};
