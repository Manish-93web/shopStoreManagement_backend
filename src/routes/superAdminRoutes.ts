import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { getSystemStats, getAllStores, toggleStoreStatus, getSystemAuditLogs, broadcastNotification } from '../controllers/superAdminController.js';
import { getAllFeatureFlags, createFeatureFlag, updateFeatureFlag, deleteFeatureFlag } from '../controllers/featureFlagController.js';

const router = express.Router();

router.use(protect);
router.use(authorize('SUPER_ADMIN'));

router.get('/stats', getSystemStats);
router.get('/stores', getAllStores);
router.put('/stores/:id/status', toggleStoreStatus);
router.get('/audit-logs', getSystemAuditLogs);
router.post('/broadcast', broadcastNotification);

// Feature Flags
router.route('/feature-flags')
    .get(getAllFeatureFlags)
    .post(createFeatureFlag);

router.route('/feature-flags/:id')
    .put(updateFeatureFlag)
    .delete(deleteFeatureFlag);

export default router;
