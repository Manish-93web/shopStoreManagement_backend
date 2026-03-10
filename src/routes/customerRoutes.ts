import express from 'express';
import { protect } from '../middleware/auth.js';
import { tenantHandler } from '../middleware/tenantHandler.js';
import { getCustomers, createCustomer, updateLoyaltyPoints } from '../controllers/customerController.js';

const router = express.Router();

router.use(protect, tenantHandler);

router.route('/')
    .get(getCustomers)
    .post(createCustomer);

router.route('/:id/loyalty')
    .post(updateLoyaltyPoints);

export default router;
