import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { tenantHandler } from '../middleware/tenantHandler.js';
import { checkTrialExpiry } from '../middleware/usageLimits.js';
import { createTransfer, approveTransfer, shipTransfer, receiveTransfer, getTransfers } from '../controllers/transferController.js';
const router = express.Router();
router.use(protect, tenantHandler, checkTrialExpiry);
router.route('/')
    .post(authorize('STORE_OWNER', 'MANAGER'), createTransfer)
    .get(getTransfers);
router.route('/:id/approve')
    .put(authorize('STORE_OWNER', 'MANAGER'), approveTransfer);
router.route('/:id/ship')
    .put(authorize('STORE_OWNER', 'MANAGER'), shipTransfer);
router.route('/:id/receive')
    .put(authorize('STORE_OWNER', 'MANAGER'), receiveTransfer);
export default router;
