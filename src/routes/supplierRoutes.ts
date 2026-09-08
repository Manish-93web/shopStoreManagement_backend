import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { tenantHandler } from '../middleware/tenantHandler.js';
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier } from '../controllers/supplierController.js';

const router = express.Router();

router.use(protect, tenantHandler);

router.route('/')
    .get(getSuppliers)
    .post(authorize('STORE_OWNER', 'MANAGER'), createSupplier);

router.route('/:id')
    .put(authorize('STORE_OWNER', 'MANAGER'), updateSupplier)
    .delete(authorize('STORE_OWNER'), deleteSupplier);

export default router;
