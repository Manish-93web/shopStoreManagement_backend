import Category from '../models/Category.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/apiResponse.js';
// @desc    Get all categories for a store
// @route   GET /api/categories
// @access  Private
export const getCategories = asyncHandler(async (req, res) => {
    const { tree } = req.query;
    const categories = await Category.find({ storeId: req.tenantId }).lean();
    if (tree === 'true') {
        const categoryMap = new Map();
        const roots = [];
        categories.forEach(cat => {
            categoryMap.set(cat._id.toString(), { ...cat, children: [] });
        });
        categories.forEach(cat => {
            const node = categoryMap.get(cat._id.toString());
            if (cat.parentId) {
                const parent = categoryMap.get(cat.parentId.toString());
                if (parent) {
                    parent.children.push(node);
                }
                else {
                    roots.push(node);
                }
            }
            else {
                roots.push(node);
            }
        });
        return res.status(200).json(new ApiResponse(200, roots));
    }
    res.status(200).json(new ApiResponse(200, categories));
});
// @desc    Create a new category
// @route   POST /api/categories
// @access  Private (Owner/Manager)
export const createCategory = asyncHandler(async (req, res) => {
    const { name, description, parentId } = req.body;
    const category = await Category.create({
        name,
        description,
        parentId: parentId || undefined,
        storeId: req.tenantId
    });
    res.status(201).json(new ApiResponse(201, category, "Category created successfully"));
});
// @desc    Update category
// @route   PUT /api/categories/:id
// @access  Private (Owner/Manager)
export const updateCategory = asyncHandler(async (req, res) => {
    const category = await Category.findOneAndUpdate({ _id: req.params.id, storeId: req.tenantId }, req.body, { new: true });
    if (!category) {
        return res.status(404).json(new ApiResponse(404, null, "Category not found"));
    }
    res.status(200).json(new ApiResponse(200, category, "Category updated successfully"));
});
// @desc    Delete category
// @route   DELETE /api/categories/:id
// @access  Private (Owner/Manager)
export const deleteCategory = asyncHandler(async (req, res) => {
    const category = await Category.findOneAndDelete({ _id: req.params.id, storeId: req.tenantId });
    if (!category) {
        return res.status(404).json(new ApiResponse(404, null, "Category not found"));
    }
    res.status(200).json(new ApiResponse(200, null, "Category deleted successfully"));
});
