import express from 'express';
import { protect } from '../middleware/auth.js';
import { tenantHandler } from '../middleware/tenantHandler.js';
import { createOrder, getOrders, getOrderById } from '../controllers/orderController.js';
import { checkUsageLimits } from '../middleware/usageLimits.js';
const router = express.Router();
router.use(protect, tenantHandler);
router.route('/')
    .post(checkUsageLimits('ORDER'), createOrder)
    .get(getOrders);
router.route('/:id')
    .get(getOrderById);
export default router;
