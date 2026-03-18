import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { tenantHandler } from '../middleware/tenantHandler.js';
import { subscriptionController } from '../controllers/subscriptionController.js';

const router = express.Router();

router.use(protect, tenantHandler);

router.get('/my-plan', subscriptionController.getSubscription);
router.post('/upgrade', authorize('Owner'), subscriptionController.upgradePlan);

// Super Admin Only
router.get('/all-plans', authorize('SUPER_ADMIN'), subscriptionController.getPlans);
router.post('/plans', authorize('SUPER_ADMIN'), subscriptionController.createPlan);
router.put('/plans/:id', authorize('SUPER_ADMIN'), subscriptionController.updatePlan);
router.delete('/plans/:id', authorize('SUPER_ADMIN'), subscriptionController.deletePlan);
router.get('/all-invoices', authorize('SUPER_ADMIN'), subscriptionController.getSystemInvoices);

export default router;
