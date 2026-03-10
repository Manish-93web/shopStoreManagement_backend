import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { tenantHandler } from '../middleware/tenantHandler.js';
import { checkUsageLimits, checkTrialExpiry } from '../middleware/usageLimits.js';
import { getCategories, createCategory, updateCategory, deleteCategory } from '../controllers/categoryController.js';
import { getProducts, createProduct, updateProduct, deleteProduct, bulkImportProducts, adjustStock } from '../controllers/productController.js';
const router = express.Router();
router.use(protect, tenantHandler, checkTrialExpiry);
// Category Routes
router.route('/categories')
    .get(getCategories)
    .post(authorize('STORE_OWNER', 'MANAGER'), createCategory);
router.route('/categories/:id')
    .put(authorize('STORE_OWNER', 'MANAGER'), updateCategory)
    .delete(authorize('STORE_OWNER', 'MANAGER'), deleteCategory);
// Bulk Import
router.post('/bulk', authorize('STORE_OWNER', 'MANAGER'), bulkImportProducts);
// Product Routes
router.route('/')
    .get(getProducts)
    .post(authorize('STORE_OWNER', 'MANAGER'), checkUsageLimits('PRODUCT'), createProduct);
router.route('/:id')
    .put(authorize('STORE_OWNER', 'MANAGER'), updateProduct)
    .delete(authorize('STORE_OWNER', 'MANAGER'), deleteProduct);
// Manual Stock Adjustment
router.patch('/:id/adjust', authorize('STORE_OWNER', 'MANAGER', 'Cashier'), adjustStock);
export default router;
