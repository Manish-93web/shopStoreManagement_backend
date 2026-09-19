import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { tenantHandler } from '../middleware/tenantHandler.js';
import { checkTrialExpiry } from '../middleware/usageLimits.js';
import { backupController } from '../controllers/backupController.js';

const router = express.Router();

router.use(protect, tenantHandler, checkTrialExpiry);

router.get('/export', authorize('STORE_OWNER'), backupController.exportData);
// Super Admin needs the platform-wide backup registry for the Backups super-admin page;
// every other backup route stays store-owner-only (they mutate/export a single tenant's data).
router.get('/history', authorize('STORE_OWNER', 'SUPER_ADMIN'), backupController.getBackupHistory);
router.post('/trigger', authorize('STORE_OWNER'), backupController.triggerBackup);
router.post('/restore/:id', authorize('STORE_OWNER'), backupController.restoreBackup);

export default router;
