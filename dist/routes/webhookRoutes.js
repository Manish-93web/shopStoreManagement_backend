import express from 'express';
import { stripeWebhook, razorpayWebhook } from '../controllers/webhookController.js';
const router = express.Router();
// Webhooks must use express.raw() for signature verification in some cases, 
// handled in app.ts by applying routes before express.json() if needed.
router.post('/stripe', express.raw({ type: 'application/json' }), stripeWebhook);
router.post('/razorpay', razorpayWebhook);
export default router;
