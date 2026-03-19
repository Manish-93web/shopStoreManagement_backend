import express from 'express';
import { protect } from '../middleware/auth.js';
import { tenantHandler } from '../middleware/tenantHandler.js';
import {
    getDashboardSummary,
    getRetentionStats,
    getCategoryGrowth,
    getRetentionTrends
} from '../controllers/analyticsController.js';

import { checkFeatureAccess } from '../middleware/featureAccess.js';

const router = express.Router();

router.use(protect, tenantHandler, checkFeatureAccess('Basic Analytics'));

router.get('/prediction', getSalesPrediction);
router.get('/categories', getCategoryAnalytics);
router.get('/suppliers', getSupplierAnalytics);
router.get('/summary', getDashboardSummary);
router.get('/retention', getRetentionStats);
router.get('/category-growth', getCategoryGrowth);
router.get('/retention-trends', getRetentionTrends);

export default router;
