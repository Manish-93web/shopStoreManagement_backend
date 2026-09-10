import express from 'express';
import { protect } from '../middleware/auth.js';
import { tenantHandler } from '../middleware/tenantHandler.js';
import { checkTrialExpiry } from '../middleware/usageLimits.js';
import { globalSearchController } from '../controllers/searchController.js';
const router = express.Router();
router.use(protect, tenantHandler, checkTrialExpiry);
router.get('/', globalSearchController.search);
export default router;
