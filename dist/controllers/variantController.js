import ProductVariant from '../models/ProductVariant.js';
import Product from '../models/Product.js';
import Inventory from '../models/Inventory.js';
import ApiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
// @desc    Get all variants for a product
// @route   GET /api/v1/products/:productId/variants
export const getVariants = asyncHandler(async (req, res) => {
    const variants = await ProductVariant.find({
        productId: req.params.productId,
        storeId: req.tenantId
    });
    res.status(200).json(new ApiResponse(200, variants));
});
// @desc    Create a product variant
// @route   POST /api/v1/products/:productId/variants
export const createVariant = asyncHandler(async (req, res) => {
    const { productId } = req.params;
    const variantData = {
        ...req.body,
        productId,
        storeId: req.tenantId
    };
    const variant = await ProductVariant.create(variantData);
    // Initialize inventory for this variant
    await Inventory.create({
        product: productId,
        variant: variant._id,
        store: req.tenantId,
        quantity: req.body.initialStock || 0
    });
    // Mark parent product as having variants
    await Product.findByIdAndUpdate(productId, { hasVariants: true });
    res.status(201).json(new ApiResponse(201, variant, "Variant created successfully"));
});
// @desc    Update a variant
// @route   PUT /api/v1/products/variants/:id
export const updateVariant = asyncHandler(async (req, res) => {
    const variant = await ProductVariant.findOneAndUpdate({ _id: req.params.id, storeId: req.tenantId }, req.body, { new: true });
    if (!variant)
        return res.status(404).json(new ApiResponse(404, null, "Variant not found"));
    res.status(200).json(new ApiResponse(200, variant, "Variant updated successfully"));
});
// @desc    Delete a variant
// @route   DELETE /api/v1/products/variants/:id
export const deleteVariant = asyncHandler(async (req, res) => {
    const variant = await ProductVariant.findOneAndDelete({ _id: req.params.id, storeId: req.tenantId });
    if (!variant)
        return res.status(404).json(new ApiResponse(404, null, "Variant not found"));
    // Cleanup inventory
    await Inventory.deleteMany({ variant: req.params.id });
    // Check if any variants left
    const remainingCount = await ProductVariant.countDocuments({ productId: variant.productId });
    if (remainingCount === 0) {
        await Product.findByIdAndUpdate(variant.productId, { hasVariants: false });
    }
    res.status(200).json(new ApiResponse(200, null, "Variant deleted successfully"));
});
