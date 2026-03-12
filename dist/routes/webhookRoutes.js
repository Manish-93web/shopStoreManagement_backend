import express from 'express';
import { stripeWebhook, razorpayWebhook, getWebhooks, createWebhook, updateWebhook, deleteWebhook, getWebhookLogs } from '../controllers/webhookController.js';
import { protect } from '../middleware/auth.js';
import { tenantHandler } from '../middleware/tenantHandler.js';
const router = express.Router();
// Webhooks must use express.raw() for signature verification in some cases, 
// handled in app.ts by applying routes before express.json() if needed.
router.post('/stripe', express.raw({ type: 'application/json' }), stripeWebhook);
router.post('/razorpay', razorpayWebhook);
// Outgoing Webhooks CRUD (requires authentication and tenant context)
router.use(protect);
router.use(tenantHandler);
router.route('/')
    .get(getWebhooks)
    .post(createWebhook);
router.route('/:id')
    .put(updateWebhook)
    .delete(deleteWebhook);
router.get('/:id/logs', getWebhookLogs);
export default router;
