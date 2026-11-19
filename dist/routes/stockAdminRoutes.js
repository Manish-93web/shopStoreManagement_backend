import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { tenantHandler } from '../middleware/tenantHandler.js';
import { checkTrialExpiry } from '../middleware/usageLimits.js';
import { bulkPriceUpdate, convertStock, generateVariants, getAdjustmentRequests, decideAdjustmentRequest, } from '../controllers/stockAdminController.js';
import { getInventoryReport } from '../controllers/inventoryReportController.js';
const router = express.Router();
router.use(protect, tenantHandler, checkTrialExpiry);
router.post('/bulk-price', authorize('STORE_OWNER', 'MANAGER'), bulkPriceUpdate);
router.post('/convert', authorize('STORE_OWNER', 'MANAGER'), convertStock);
router.post('/variants/:productId/generate', authorize('STORE_OWNER', 'MANAGER'), generateVariants);
router.get('/adjustment-requests', authorize('STORE_OWNER', 'MANAGER'), getAdjustmentRequests);
// Only the owner decides — a manager cannot approve their own request.
router.put('/adjustment-requests/:id/:decision', authorize('STORE_OWNER'), decideAdjustmentRequest);
router.get('/reports/:type', authorize('STORE_OWNER', 'MANAGER'), getInventoryReport);
export default router;
