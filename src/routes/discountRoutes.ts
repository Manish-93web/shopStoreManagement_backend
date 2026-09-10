import express from 'express';
import { protect } from '../middleware/auth.js';
import { tenantHandler } from '../middleware/tenantHandler.js';
import { checkTrialExpiry } from '../middleware/usageLimits.js';
import { validateDiscount, createDiscount } from '../controllers/discountController.js';

const router = express.Router();

router.use(protect, tenantHandler, checkTrialExpiry);

router.post('/validate', validateDiscount);
router.post('/', createDiscount);

export default router;
