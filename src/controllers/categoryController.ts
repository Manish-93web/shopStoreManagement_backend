import { Response } from 'express';
import Category from '../models/Category.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/apiResponse.js';
import { TenantRequest } from '../middleware/tenantHandler.js';

// @desc    Get all categories for a store
// @route   GET /api/categories
// @access  Private
export const getCategories = asyncHandler(async (req: TenantRequest, res: Response) => {
    const categories = await Category.find({ storeId: req.tenantId });
    res.status(200).json(new ApiResponse(200, categories));
});

// @desc    Create a new category
// @route   POST /api/categories
// @access  Private (Owner/Manager)
export const createCategory = asyncHandler(async (req: TenantRequest, res: Response) => {
    const { name, description } = req.body;

    const category = await Category.create({
        name,
        description,
        storeId: req.tenantId
    });

    res.status(201).json(new ApiResponse(201, category, "Category created successfully"));
});

// @desc    Update category
// @route   PUT /api/categories/:id
// @access  Private (Owner/Manager)
export const updateCategory = asyncHandler(async (req: TenantRequest, res: Response) => {
    const category = await Category.findOneAndUpdate(
        { _id: req.params.id, storeId: req.tenantId },
        req.body,
        { new: true }
    );

    if (!category) {
        return res.status(404).json(new ApiResponse(404, null, "Category not found"));
    }

    res.status(200).json(new ApiResponse(200, category, "Category updated successfully"));
});

// @desc    Delete category
// @route   DELETE /api/categories/:id
// @access  Private (Owner/Manager)
export const deleteCategory = asyncHandler(async (req: TenantRequest, res: Response) => {
    const category = await Category.findOneAndDelete({ _id: req.params.id, storeId: req.tenantId });

    if (!category) {
        return res.status(404).json(new ApiResponse(404, null, "Category not found"));
    }

    res.status(200).json(new ApiResponse(200, null, "Category deleted successfully"));
});
