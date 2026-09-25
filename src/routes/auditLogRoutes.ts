import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { tenantHandler } from '../middleware/tenantHandler.js';
import { checkTrialExpiry } from '../middleware/usageLimits.js';
import { getStoreAuditLogs } from '../controllers/auditLogController.js';

const router = express.Router();

router.use(protect, tenantHandler, checkTrialExpiry);

router.get('/', authorize('STORE_OWNER', 'MANAGER'), getStoreAuditLogs);

export default router;
