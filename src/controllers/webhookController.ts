import { Request, Response } from 'express';
import Stripe from 'stripe';
import razorpay from 'razorpay';
import Store from '../models/Store.js';
import Webhook from '../models/Webhook.js';
import WebhookLog from '../models/WebhookLog.js';
import asyncHandler from '../utils/asyncHandler.js';
import { TenantRequest } from '../middleware/tenantHandler.js';
import ApiResponse from '../utils/apiResponse.js';
import crypto from 'crypto';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-02-24-preview' as any,
});

export const stripeWebhook = asyncHandler(async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature']!;
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEB_HOOK_SECRET!);
    } catch (err: any) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        const storeId = session.metadata?.storeId;

        if (storeId) {
            await Store.findByIdAndUpdate(storeId, {
                subscriptionStatus: 'Active',
                lastBillingDate: new Date()
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

export const razorpayWebhook = asyncHandler(async (req: Request, res: Response) => {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET!;
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
        isActive: true
    });

    res.status(201).json(new ApiResponse(201, webhook, "Webhook created successfully"));
});

// @desc    Update a webhook
// @route   PUT /api/webhooks/:id
export const updateWebhook = asyncHandler(async (req: TenantRequest, res: Response) => {
    const webhook = await Webhook.findOneAndUpdate(
        { _id: req.params.id, tenantId: req.tenantId },
        req.body,
        { new: true }
    );

    if (!webhook) {
        return res.status(404).json(new ApiResponse(404, null, "Webhook not found"));
    }

    res.status(200).json(new ApiResponse(200, webhook, "Webhook updated successfully"));
});

// @desc    Delete a webhook
// @route   DELETE /api/webhooks/:id
export const deleteWebhook = asyncHandler(async (req: TenantRequest, res: Response) => {
    const webhook = await Webhook.findOneAndDelete({ _id: req.params.id, tenantId: req.tenantId });

    if (!webhook) {
        return res.status(404).json(new ApiResponse(404, null, "Webhook not found"));
    }

    // Also delete associated logs
    await WebhookLog.deleteMany({ webhookId: webhook._id });

    res.status(200).json(new ApiResponse(200, null, "Webhook deleted successfully"));
});

// @desc    Get webhook delivery logs
// @route   GET /api/webhooks/:id/logs
export const getWebhookLogs = asyncHandler(async (req: TenantRequest, res: Response) => {
    const logs = await WebhookLog.find({
        webhookId: req.params.id,
        tenantId: req.tenantId
    }).sort({ createdAt: -1 }).limit(50);

    res.status(200).json(new ApiResponse(200, logs));
});
