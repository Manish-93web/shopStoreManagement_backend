import express from 'express';
import { protect } from '../middleware/auth.js';
import { tenantHandler } from '../middleware/tenantHandler.js';
import { checkFeatureAccess } from '../middleware/featureAccess.js';
const router = express.Router();
router.use(protect, tenantHandler);
router.route('/')
    .post(checkFeatureAccess('POS Access'), checkUsageLimits('ORDER'), createOrder)
    .get(getOrders);
router.route('/:id')
    .get(getOrderById);
export default router;
