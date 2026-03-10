import express from 'express';
import { protect } from '../middleware/auth.js';
import { tenantHandler } from '../middleware/tenantHandler.js';
import { createOrder, getOrders, getOrderById } from '../controllers/orderController.js';

const router = express.Router();

router.use(protect, tenantHandler);

router.route('/')
    .post(createOrder)
    .get(getOrders);

router.route('/:id')
    .get(getOrderById);

export default router;
