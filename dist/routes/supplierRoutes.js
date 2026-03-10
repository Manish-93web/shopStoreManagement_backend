import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { tenantHandler } from '../middleware/tenantHandler.js';
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier } from '../controllers/supplierController.js';
const router = express.Router();
router.use(protect, tenantHandler);
router.route('/')
    .get(getSuppliers)
    .post(authorize('Owner', 'Manager'), createSupplier);
router.route('/:id')
    .put(authorize('Owner', 'Manager'), updateSupplier)
    .delete(authorize('Owner'), deleteSupplier);
export default router;
