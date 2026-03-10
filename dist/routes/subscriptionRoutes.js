import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { tenantHandler } from '../middleware/tenantHandler.js';
import { subscriptionController } from '../controllers/subscriptionController.js';
const router = express.Router();
router.use(protect, tenantHandler);
router.get('/my-plan', subscriptionController.getSubscription);
router.post('/upgrade', authorize('Owner'), subscriptionController.upgradePlan);
export default router;
