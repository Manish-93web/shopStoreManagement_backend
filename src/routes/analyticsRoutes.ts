import express from 'express';
import { protect } from '../middleware/auth.js';
import { tenantHandler } from '../middleware/tenantHandler.js';
import { getSalesPrediction, getCategoryAnalytics, getSupplierAnalytics } from '../controllers/analyticsController.js';

const router = express.Router();

router.use(protect, tenantHandler);

router.get('/prediction', getSalesPrediction);
router.get('/categories', getCategoryAnalytics);
router.get('/suppliers', getSupplierAnalytics);

export default router;
