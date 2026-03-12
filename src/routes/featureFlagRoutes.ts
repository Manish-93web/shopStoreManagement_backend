import express from 'express';
import { evaluateFeatureFlags } from '../controllers/featureFlagController.js';
import { protect } from '../middleware/auth.js';
import { tenantHandler } from '../middleware/tenantHandler.js';

const router = express.Router();

router.use(protect);
router.use(tenantHandler);

router.get('/evaluate', evaluateFeatureFlags);

export default router;
