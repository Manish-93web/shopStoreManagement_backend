import express from 'express';
import { getBrands, createBrand, updateBrand, deleteBrand } from '../controllers/brandController.js';
import { protect, authorize } from '../middleware/auth.js';
import { tenantHandler } from '../middleware/tenantHandler.js';
const router = express.Router();
router.use(protect);
router.use(tenantHandler);
router.route('/')
    .get(getBrands)
    .post(authorize('STORE_OWNER', 'MANAGER'), createBrand);
router.route('/:id')
    .put(authorize('STORE_OWNER', 'MANAGER'), updateBrand)
    .delete(authorize('STORE_OWNER'), deleteBrand);
export default router;
