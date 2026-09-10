import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import {
    getSystemStats,
    getSystemHealth,
    getAllStores,
    getTenantAnalytics,
    toggleStoreStatus,
    approveStore,
    getSystemAuditLogs,
    broadcastNotification,
    sendTenantNotification,
} from '../controllers/superAdminController.js';
import {
    getAllFeatureFlags,
    createFeatureFlag,
    updateFeatureFlag,
    deleteFeatureFlag,
} from '../controllers/featureFlagController.js';

const router = express.Router();

router.use(protect);
router.use(authorize('SUPER_ADMIN'));

router.get('/stats', getSystemStats);
router.get('/health', getSystemHealth);
router.get('/stores', getAllStores);
router.get('/stores/:id/analytics', getTenantAnalytics);
router.post('/stores/:id/notify', sendTenantNotification);
router.put('/stores/:id/status', toggleStoreStatus);
router.put('/stores/:id/approve', approveStore);
router.get('/audit-logs', getSystemAuditLogs);
router.post('/broadcast', broadcastNotification);

// Feature Flags
router.route('/feature-flags').get(getAllFeatureFlags).post(createFeatureFlag);

router.route('/feature-flags/:id').put(updateFeatureFlag).delete(deleteFeatureFlag);

export default router;
