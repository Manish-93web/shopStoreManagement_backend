import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { tenantHandler } from '../middleware/tenantHandler.js';
import { createPurchaseOrder, receivePurchaseOrder, getPurchaseOrders, approvePurchaseOrder } from '../controllers/purchaseOrderController.js';

const router = express.Router();

router.use(protect, tenantHandler);

router.route('/')
    .post(authorize('STORE_OWNER', 'MANAGER'), createPurchaseOrder)
    .get(getPurchaseOrders);

router.route('/:id/approve')
    .put(authorize('STORE_OWNER', 'MANAGER'), approvePurchaseOrder);

router.route('/:id/receive')
    .put(authorize('STORE_OWNER', 'MANAGER'), receivePurchaseOrder);

export default router;
