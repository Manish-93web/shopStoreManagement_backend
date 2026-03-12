import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { tenantHandler } from '../middleware/tenantHandler.js';
import { archiveController } from '../controllers/archiveController.js';

const router = express.Router();

router.use(protect, tenantHandler);

router.get('/jobs', authorize('Owner'), archiveController.getJobs);
router.post('/run', authorize('Owner'), archiveController.runArchive);

export default router;
