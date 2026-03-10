import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { tenantHandler } from '../middleware/tenantHandler.js';
import {
    getSupplierPayments,
    createSupplierPayment,
    getAllSupplierPayments
} from '../controllers/supplierPaymentController.js';

const router = express.Router();

router.use(protect, tenantHandler);

router.route('/')
    .get(getAllSupplierPayments)
    .post(authorize('STORE_OWNER', 'MANAGER'), createSupplierPayment);

router.get('/supplier/:supplierId', getSupplierPayments);

export default router;
