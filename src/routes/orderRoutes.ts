import express from 'express';
import { protect } from '../middleware/auth.js';
import { tenantHandler } from '../middleware/tenantHandler.js';
import { checkTrialExpiry } from '../middleware/usageLimits.js';
import { checkFeatureAccess } from '../middleware/featureAccess.js';
import { checkUsageLimits } from '../middleware/usageLimits.js';
import { createOrder, getOrders, getOrderById, cancelOrder, logWhatsAppSent } from '../controllers/orderController.js';

const router = express.Router();

router.use(protect, tenantHandler, checkTrialExpiry);

router.route('/').post(checkFeatureAccess('POS Access'), checkUsageLimits('ORDER'), createOrder).get(getOrders);

router.route('/:id').get(getOrderById);

router.route('/:id/cancel').put(cancelOrder);

router.route('/:id/whatsapp-log').post(logWhatsAppSent);

export default router;
