import express from 'express';
import { protect } from '../middleware/auth.js';
import { tenantHandler } from '../middleware/tenantHandler.js';
import { checkTrialExpiry } from '../middleware/usageLimits.js';
import { testPrinter, testScanner, testDrawer } from '../controllers/hardwareController.js';

const router = express.Router();

router.use(protect, tenantHandler, checkTrialExpiry);

router.post('/test-printer', testPrinter);
router.post('/test-scanner', testScanner);
router.post('/test-drawer', testDrawer);

export default router;
