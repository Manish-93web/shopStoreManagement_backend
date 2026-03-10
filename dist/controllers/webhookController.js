import Stripe from 'stripe';
import Store from '../models/Store.js';
import asyncHandler from '../utils/asyncHandler.js';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-02-24-preview',
});
export const stripeWebhook = asyncHandler(async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEB_HOOK_SECRET);
    }
    catch (err) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const storeId = session.metadata?.storeId;
        if (storeId) {
            await Store.findByIdAndUpdate(storeId, {
                'subscription.status': 'ACTIVE',
                'subscription.expiryDate': new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
            });
            console.log(`Store ${storeId} subscription activated via Stripe.`);
        }
    }
    res.json({ received: true });
});
export const razorpayWebhook = asyncHandler(async (req, res) => {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'];
    // In a real implementation, use razorpay.validateWebhookSignature(req.body, signature, secret)
    // For now, assuming successful payment if body contains payment.captured
    if (req.body.event === 'payment.captured') {
        const storeId = req.body.payload.payment.entity.notes.storeId;
        if (storeId) {
            await Store.findByIdAndUpdate(storeId, {
                'subscription.status': 'ACTIVE',
                'subscription.expiryDate': new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            });
            console.log(`Store ${storeId} subscription activated via Razorpay.`);
        }
    }
    res.json({ status: 'ok' });
});
