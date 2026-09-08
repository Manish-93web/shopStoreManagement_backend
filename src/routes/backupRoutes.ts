import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { tenantHandler } from '../middleware/tenantHandler.js';
import { backupController } from '../controllers/backupController.js';

const router = express.Router();

router.use(protect, tenantHandler);

router.get('/export', authorize('STORE_OWNER'), backupController.exportData);
router.get('/history', authorize('STORE_OWNER'), backupController.getBackupHistory);
router.post('/trigger', authorize('STORE_OWNER'), backupController.triggerBackup);
router.post('/restore/:id', authorize('STORE_OWNER'), backupController.restoreBackup);

export default router;
