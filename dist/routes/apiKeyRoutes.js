import express from 'express';
import { getApiKeys, createApiKey, updateApiKey, deleteApiKey } from '../controllers/apiKeyController.js';
import { protect, authorize } from '../middleware/auth.js';
import { tenantHandler } from '../middleware/tenantHandler.js';
const router = express.Router();
// An API key grants programmatic access to this store's whole API — store-owner-only,
// matching Backups/Archive/TaxRule/Webhooks.
router.use(protect);
router.use(tenantHandler);
router.use(authorize('STORE_OWNER'));
router.route('/').get(getApiKeys).post(createApiKey);
router.route('/:id').put(updateApiKey).delete(deleteApiKey);
export default router;
