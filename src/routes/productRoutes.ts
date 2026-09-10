import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { tenantHandler } from '../middleware/tenantHandler.js';
import { checkUsageLimits, checkTrialExpiry } from '../middleware/usageLimits.js';
import { sanitizeFields } from '../middleware/sanitize.js';
import {
    getProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
    bulkImportProducts,
    bulkUpdateProducts,
    adjustStock,
} from '../controllers/productController.js';
import { getVariants, createVariant, updateVariant, deleteVariant } from '../controllers/variantController.js';

const router = express.Router();

router.use(protect, tenantHandler, checkTrialExpiry);

// Bulk Import/Update
router
    .route('/bulk')
    .post(authorize('STORE_OWNER', 'MANAGER'), bulkImportProducts)
    .put(authorize('STORE_OWNER', 'MANAGER'), bulkUpdateProducts);

// Product Routes
router
    .route('/')
    .get(getProducts)
    .post(
        authorize('STORE_OWNER', 'MANAGER'),
        checkUsageLimits('PRODUCT'),
        sanitizeFields('description'),
        createProduct
    );

router
    .route('/:id')
    .get(getProductById)
    .put(authorize('STORE_OWNER', 'MANAGER'), sanitizeFields('description'), updateProduct)
    .delete(authorize('STORE_OWNER', 'MANAGER'), deleteProduct);

// Variant Routes (Scoped to Product)
router.route('/:productId/variants').get(getVariants).post(authorize('STORE_OWNER', 'MANAGER'), createVariant);

router
    .route('/variants/:id')
    .put(authorize('STORE_OWNER', 'MANAGER'), updateVariant)
    .delete(authorize('STORE_OWNER', 'MANAGER'), deleteVariant);

// Manual Stock Adjustment
router.patch('/:id/adjust', authorize('STORE_OWNER', 'MANAGER', 'CASHIER'), adjustStock);

export default router;
