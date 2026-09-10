import mongoose from 'mongoose';
import Brand from '../models/Brand.js';
import Product from '../models/Product.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/apiResponse.js';
// @desc    Get all brands
// @route   GET /api/brands
export const getBrands = asyncHandler(async (req, res) => {
    const brands = await Brand.find({ storeId: req.tenantId }).lean();
    const counts = await Product.aggregate([
        { $match: { storeId: new mongoose.Types.ObjectId(req.tenantId), brand: { $ne: null } } },
        { $group: { _id: '$brand', count: { $sum: 1 } } }
    ]);
    const countMap = new Map(counts.map(c => [c._id.toString(), c.count]));
    const brandsWithCounts = brands.map(b => ({
        ...b,
        productCount: countMap.get(b._id.toString()) || 0
    }));
    res.status(200).json(new ApiResponse(200, brandsWithCounts));
});
// @desc    Create brand
// @route   POST /api/brands
export const createBrand = asyncHandler(async (req, res) => {
    const { name, description, logo } = req.body;
    const brand = await Brand.create({
        name,
        description,
        logo,
        storeId: req.tenantId
    });
    res.status(201).json(new ApiResponse(201, brand, 'Brand created'));
});
// @desc    Update brand
// @route   PUT /api/brands/:id
export const updateBrand = asyncHandler(async (req, res) => {
    const brand = await Brand.findOneAndUpdate({ _id: req.params.id, storeId: req.tenantId }, req.body, { returnDocument: 'after' });
    if (!brand)
        return res.status(404).json(new ApiResponse(404, null, 'Brand not found'));
    res.status(200).json(new ApiResponse(200, brand, 'Brand updated'));
});
// @desc    Delete brand
// @route   DELETE /api/brands/:id
export const deleteBrand = asyncHandler(async (req, res) => {
    const brand = await Brand.findOneAndDelete({ _id: req.params.id, storeId: req.tenantId });
    if (!brand)
        return res.status(404).json(new ApiResponse(404, null, 'Brand not found'));
    res.status(200).json(new ApiResponse(200, null, 'Brand deleted'));
});
