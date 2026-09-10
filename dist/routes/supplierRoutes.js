import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { tenantHandler } from '../middleware/tenantHandler.js';
import { checkTrialExpiry } from '../middleware/usageLimits.js';
import { getSuppliers, getSupplierById, createSupplier, updateSupplier, deleteSupplier, } from '../controllers/supplierController.js';
import { sanitizeFields } from '../middleware/sanitize.js';
const router = express.Router();
router.use(protect, tenantHandler, checkTrialExpiry);
router.route('/').get(getSuppliers).post(authorize('STORE_OWNER', 'MANAGER'), sanitizeFields('notes'), createSupplier);
router
    .route('/:id')
    .get(getSupplierById)
    .put(authorize('STORE_OWNER', 'MANAGER'), sanitizeFields('notes'), updateSupplier)
    .delete(authorize('STORE_OWNER'), deleteSupplier);
export default router;
