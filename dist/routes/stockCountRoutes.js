import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { tenantHandler } from '../middleware/tenantHandler.js';
import { checkTrialExpiry } from '../middleware/usageLimits.js';
import { createStockCount, getStockCounts, getStockCountById, saveStockCount, completeStockCount, deleteStockCount, } from '../controllers/stockCountController.js';
const router = express.Router();
router.use(protect, tenantHandler, checkTrialExpiry);
router.route('/').get(getStockCounts).post(authorize('STORE_OWNER', 'MANAGER'), createStockCount);
router
    .route('/:id')
    .get(getStockCountById)
    .put(authorize('STORE_OWNER', 'MANAGER'), saveStockCount)
    .delete(authorize('STORE_OWNER', 'MANAGER'), deleteStockCount);
router.post('/:id/complete', authorize('STORE_OWNER', 'MANAGER'), completeStockCount);
export default router;
