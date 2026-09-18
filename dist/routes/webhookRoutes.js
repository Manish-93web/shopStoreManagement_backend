import express from 'express';
import { getWebhooks, createWebhook, updateWebhook, deleteWebhook, getWebhookLogs, } from '../controllers/webhookController.js';
import { protect, authorize } from '../middleware/auth.js';
import { tenantHandler } from '../middleware/tenantHandler.js';
const router = express.Router();
// Payment gateway webhooks (/stripe, /razorpay) are mounted directly on `app` in app.ts,
// before the global express.json() middleware — they need the raw request body for
// signature verification, which this router (reached after express.json() has already
// consumed the stream) cannot provide.
// Outgoing Webhooks CRUD — a webhook can be pointed at any external URL and receives a
// feed of store events, so this is store-owner-only, matching Backups/Archive/TaxRule.
router.use(protect);
router.use(tenantHandler);
router.use(authorize('STORE_OWNER'));
router.route('/').get(getWebhooks).post(createWebhook);
router.route('/:id').put(updateWebhook).delete(deleteWebhook);
router.get('/:id/logs', getWebhookLogs);
export default router;
