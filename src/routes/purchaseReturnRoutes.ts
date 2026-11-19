import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { tenantHandler } from '../middleware/tenantHandler.js';
import { checkTrialExpiry } from '../middleware/usageLimits.js';
import {
    createPurchaseReturn,
    getPurchaseReturns,
    getPurchaseReturnById,
} from '../controllers/purchaseBillController.js';

const router = express.Router();

router.use(protect, tenantHandler, checkTrialExpiry);

router.route('/').get(getPurchaseReturns).post(authorize('STORE_OWNER', 'MANAGER'), createPurchaseReturn);
router.get('/:id', getPurchaseReturnById);

export default router;
