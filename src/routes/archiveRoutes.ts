import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { tenantHandler } from '../middleware/tenantHandler.js';
import { checkTrialExpiry } from '../middleware/usageLimits.js';
import { archiveController } from '../controllers/archiveController.js';

const router = express.Router();

router.use(protect, tenantHandler, checkTrialExpiry);

// Super Admin needs the platform-wide archive registry for the Archive Jobs super-admin
// page; running an archive scan stays store-owner-only (it acts on a single tenant's data).
router.get('/jobs', authorize('STORE_OWNER', 'SUPER_ADMIN'), archiveController.getJobs);
router.post('/run', authorize('STORE_OWNER'), archiveController.runArchive);
router.post('/:jobId/restore', authorize('STORE_OWNER'), archiveController.restoreArchive);
router.get('/policy', authorize('STORE_OWNER'), archiveController.getPolicy);
router.put('/policy', authorize('STORE_OWNER'), archiveController.updatePolicy);

export default router;
