import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { getSystemStats, getAllStores, toggleStoreStatus, getSystemAuditLogs, broadcastNotification } from '../controllers/superAdminController.js';

const router = express.Router();

router.use(protect);
router.use(authorize('SUPER_ADMIN'));

router.get('/stats', getSystemStats);
router.get('/stores', getAllStores);
router.put('/stores/:id/status', toggleStoreStatus);
router.get('/audit-logs', getSystemAuditLogs);
router.post('/broadcast', broadcastNotification);

export default router;
