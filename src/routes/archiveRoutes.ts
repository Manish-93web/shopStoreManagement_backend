import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { tenantHandler } from '../middleware/tenantHandler.js';
import { checkTrialExpiry } from '../middleware/usageLimits.js';
import { archiveController } from '../controllers/archiveController.js';

const router = express.Router();

router.use(protect, tenantHandler, checkTrialExpiry);

router.get('/jobs', authorize('STORE_OWNER'), archiveController.getJobs);
router.post('/run', authorize('STORE_OWNER'), archiveController.runArchive);

export default router;
