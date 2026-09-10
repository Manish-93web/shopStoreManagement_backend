import { Request, Response } from 'express';
import Stripe from 'stripe';
import Razorpay from 'razorpay';
import Store from '../models/Store.js';
import Webhook from '../models/Webhook.js';
import WebhookLog from '../models/WebhookLog.js';
import SubscriptionPayment from '../models/SubscriptionPayment.js';
import SubscriptionInvoice from '../models/SubscriptionInvoice.js';
import asyncHandler from '../utils/asyncHandler.js';
import { TenantRequest } from '../middleware/tenantHandler.js';
import ApiResponse from '../utils/apiResponse.js';
import crypto from 'crypto';

let stripeClient: Stripe | null = null;

export const stripeWebhook = asyncHandler(async (req: Request, res: Response) => {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEB_HOOK_SECRET;
    if (!apiKey || !webhookSecret) {
        return res.status(503).json({ error: 'Stripe is not configured on this server' });
    }
    if (!stripeClient) {
        stripeClient = new Stripe(apiKey, { apiVersion: '2025-02-24-preview' as any });
    }

    const sig = req.headers['stripe-signature']!;
    let event;

    try {
        event = stripeClient.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        const storeId = session.metadata?.storeId;

        if (storeId) {
            await Store.findByIdAndUpdate(storeId, {
                subscriptionStatus: 'Active',
                lastBillingDate: new Date(),
            });
            console.log(`Store ${storeId} subscription activated via Stripe.`);
        }
    } else if (event.type === 'invoice.payment_succeeded') {
        const invoice = event.data.object as any;
        const storeId = invoice.subscription_details?.metadata?.storeId; // Note: depends on payload
        if (storeId) {
            await Store.findByIdAndUpdate(storeId, { subscriptionStatus: 'Active', lastBillingDate: new Date() });
        }
    } else if (event.type === 'invoice.payment_failed') {
        const invoice = event.data.object as any;
        const storeId = invoice.subscription_details?.metadata?.storeId;
        if (storeId) {
            await Store.findByIdAndUpdate(storeId, { subscriptionStatus: 'Past Due' });
            console.log(`Store ${storeId} subscription marked Past Due.`);
        }
    }

    res.json({ received: true });
});

// @desc    Razorpay webhook — verifies the signature for real (previously "assuming
//          successful payment" with no check at all), and is idempotent on
//          payment.captured so a webhook retry can't double-activate/re-credit.
export const razorpayWebhook = asyncHandler(async (req: Request, res: Response) => {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
        return res.status(503).json({ error: 'Razorpay is not configured on this server' });
    }

    const signature = req.headers['x-razorpay-signature'] as string;
    const rawBody = req.body as Buffer;

    const isValid = Razorpay.validateWebhookSignature(rawBody.toString(), signature, secret);
    if (!isValid) {
        return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    const payload = JSON.parse(rawBody.toString());

    if (payload.event === 'payment.captured') {
        const paymentEntity = payload.payload.payment.entity;
        const razorpayOrderId = paymentEntity.order_id;

        const subPayment = await SubscriptionPayment.findOne({ transactionId: razorpayOrderId });
        if (!subPayment) {
            console.log(`Razorpay webhook: no matching SubscriptionPayment for order ${razorpayOrderId}`);
            return res.json({ status: 'ok' });
        }
        if (subPayment.status === 'Completed') {
            // Already processed by an earlier delivery of this webhook — idempotent no-op.
            return res.json({ status: 'ok' });
        }

        subPayment.status = 'Completed';
        subPayment.paymentMethod = paymentEntity.method || subPayment.paymentMethod;
        subPayment.metadata = paymentEntity;
        await subPayment.save();

        const invoice = await SubscriptionInvoice.findById(subPayment.invoiceId);
        if (invoice) {
            invoice.status = 'Paid';
            invoice.paidAt = new Date();
            await invoice.save();

            await Store.findByIdAndUpdate(invoice.storeId, {
                subscriptionStatus: 'Active',
                subscriptionPlan: invoice.plan,
                lastBillingDate: new Date(),
            });
            console.log(`Store ${invoice.storeId} subscription activated via Razorpay (order ${razorpayOrderId}).`);
        }
    } else if (payload.event === 'payment.failed') {
        const paymentEntity = payload.payload.payment.entity;
        const razorpayOrderId = paymentEntity.order_id;
        await SubscriptionPayment.findOneAndUpdate(
            { transactionId: razorpayOrderId },
            { status: 'Failed', metadata: paymentEntity }
        );
    }

    res.json({ status: 'ok' });
});

// @desc    Get all webhooks for a tenant
// @route   GET /api/webhooks
export const getWebhooks = asyncHandler(async (req: TenantRequest, res: Response) => {
    const webhooks = await Webhook.find({ tenantId: req.tenantId });
    res.status(200).json(new ApiResponse(200, webhooks));
});

// @desc    Create a new webhook
// @route   POST /api/webhooks
export const createWebhook = asyncHandler(async (req: TenantRequest, res: Response) => {
    const { url, events } = req.body;

    // Generate a secure secret for this webhook
    const secret = crypto.randomBytes(32).toString('hex');

    const webhook = await Webhook.create({
        url,
        events,
        secret,
        tenantId: req.tenantId,
        isActive: true,
    });

    res.status(201).json(new ApiResponse(201, webhook, 'Webhook created successfully'));
});

// @desc    Update a webhook
// @route   PUT /api/webhooks/:id
export const updateWebhook = asyncHandler(async (req: TenantRequest, res: Response) => {
    const webhook = await Webhook.findOneAndUpdate({ _id: req.params.id, tenantId: req.tenantId }, req.body, {
        returnDocument: 'after',
    });

    if (!webhook) {
        return res.status(404).json(new ApiResponse(404, null, 'Webhook not found'));
    }

    res.status(200).json(new ApiResponse(200, webhook, 'Webhook updated successfully'));
});

// @desc    Delete a webhook
// @route   DELETE /api/webhooks/:id
export const deleteWebhook = asyncHandler(async (req: TenantRequest, res: Response) => {
    const webhook = await Webhook.findOneAndDelete({ _id: req.params.id, tenantId: req.tenantId });

    if (!webhook) {
        return res.status(404).json(new ApiResponse(404, null, 'Webhook not found'));
    }

    // Also delete associated logs
    await WebhookLog.deleteMany({ webhookId: webhook._id });

    res.status(200).json(new ApiResponse(200, null, 'Webhook deleted successfully'));
});

// @desc    Get webhook delivery logs
// @route   GET /api/webhooks/:id/logs
export const getWebhookLogs = asyncHandler(async (req: TenantRequest, res: Response) => {
    const logs = await WebhookLog.find({
        webhookId: req.params.id,
        tenantId: req.tenantId,
    })
        .sort({ createdAt: -1 })
        .limit(50);

    res.status(200).json(new ApiResponse(200, logs));
});
