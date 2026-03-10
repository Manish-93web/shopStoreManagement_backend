import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { tenantHandler } from '../middleware/tenantHandler.js';
import { backupController } from '../controllers/backupController.js';

const router = express.Router();

router.use(protect, tenantHandler);

router.get('/export', authorize('Owner'), backupController.exportData);
router.get('/history', authorize('Owner'), backupController.getBackupHistory);

export default router;
