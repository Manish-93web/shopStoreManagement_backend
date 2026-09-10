import express from 'express';
import { protect } from '../middleware/auth.js';
import { tenantHandler } from '../middleware/tenantHandler.js';
import { checkTrialExpiry } from '../middleware/usageLimits.js';
import { createExchange, getExchanges } from '../controllers/exchangeController.js';

const router = express.Router();

router.use(protect, tenantHandler, checkTrialExpiry);

router.route('/').get(getExchanges).post(createExchange);

export default router;
