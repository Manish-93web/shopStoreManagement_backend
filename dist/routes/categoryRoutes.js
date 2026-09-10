import express from 'express';
import { getCategories, createCategory, updateCategory, deleteCategory } from '../controllers/categoryController.js';
import { protect, authorize } from '../middleware/auth.js';
import { tenantHandler } from '../middleware/tenantHandler.js';
import { checkTrialExpiry } from '../middleware/usageLimits.js';
import { sanitizeFields } from '../middleware/sanitize.js';
const router = express.Router();
router.use(protect, tenantHandler, checkTrialExpiry);
router.route('/')
    .get(getCategories)
    .post(authorize('STORE_OWNER', 'MANAGER'), sanitizeFields('description'), createCategory);
router.route('/:id')
    .put(authorize('STORE_OWNER', 'MANAGER'), sanitizeFields('description'), updateCategory)
    .delete(authorize('STORE_OWNER', 'MANAGER'), deleteCategory);
export default router;
