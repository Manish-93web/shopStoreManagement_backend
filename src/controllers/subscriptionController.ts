import { Response } from 'express';
import Razorpay from 'razorpay';
import Store from '../models/Store.js';
import Plan from '../models/Plan.js';
import SubscriptionInvoice from '../models/SubscriptionInvoice.js';
import SubscriptionPayment from '../models/SubscriptionPayment.js';
import { TenantRequest } from '../middleware/tenantHandler.js';
import ApiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

let razorpayClient: Razorpay | null = null;
const getRazorpayClient = (): Razorpay | null => {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) return null;
    if (!razorpayClient) {
        razorpayClient = new Razorpay({ key_id: keyId, key_secret: keySecret });
    }
    return razorpayClient;
};

export const subscriptionController = {
    // @desc    Get current subscription plan for a tenant
    getSubscription: asyncHandler(async (req: TenantRequest, res: Response) => {
        const store = await Store.findById(req.tenantId).populate('subscriptionPlan');
        if (!store) return res.status(404).json(new ApiResponse(404, null, 'Store not found'));
        res.status(200).json(new ApiResponse(200, store));
    }),

    // @desc    Get all available plans
    getPlans: asyncHandler(async (req: TenantRequest, res: Response) => {
        const plans = await Plan.find({ isActive: true });
        res.status(200).json(new ApiResponse(200, plans));
    }),

    // @desc    Create a new plan (Super Admin)
    createPlan: asyncHandler(async (req: TenantRequest, res: Response) => {
        const plan = await Plan.create(req.body);
        res.status(201).json(new ApiResponse(201, plan, 'Plan created successfully'));
    }),

    // @desc    Update an existing plan (Super Admin)
    updatePlan: asyncHandler(async (req: TenantRequest, res: Response) => {
        const plan = await Plan.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after' });
        if (!plan) return res.status(404).json(new ApiResponse(404, null, 'Plan not found'));
        res.status(200).json(new ApiResponse(200, plan, 'Plan updated successfully'));
    }),

    // @desc    Delete a plan (Super Admin)
    deletePlan: asyncHandler(async (req: TenantRequest, res: Response) => {
        const plan = await Plan.findByIdAndDelete(req.params.id);
        if (!plan) return res.status(404).json(new ApiResponse(404, null, 'Plan not found'));
        res.status(200).json(new ApiResponse(200, null, 'Plan deleted successfully'));
    }),

    // @desc    Switch to a free (₹0) plan directly — paid plans must go through
    //          POST /subscriptions/checkout instead; only a paid webhook can activate them.
    upgradePlan: asyncHandler(async (req: TenantRequest, res: Response) => {
        const { planId } = req.body;
        const plan = await Plan.findById(planId);
        if (!plan) return res.status(404).json(new ApiResponse(404, null, 'Plan not found'));

        if (plan.price > 0) {
            return res
                .status(400)
                .json(new ApiResponse(400, null, 'This is a paid plan — use the checkout flow to activate it.'));
        }

        const store = await Store.findByIdAndUpdate(
            req.tenantId,
            {
                $set: {
                    subscriptionPlan: plan._id,
                    subscriptionStatus: 'Active',
                    lastBillingDate: new Date(),
                },
            },
            { returnDocument: 'after' }
        );

        res.status(200).json(new ApiResponse(200, store, 'Subscription updated'));
    }),

    // @desc    Start checkout for a paid plan — creates a real Razorpay Order when the
    //          gateway is configured, plus a Sent invoice + Pending payment record.
    //          The subscription only activates once the Razorpay webhook confirms payment.
    // @route   POST /subscriptions/checkout
    checkout: asyncHandler(async (req: TenantRequest, res: Response) => {
        const { planId } = req.body;
        const plan = await Plan.findById(planId);
        if (!plan) return res.status(404).json(new ApiResponse(404, null, 'Plan not found'));

        if (plan.price === 0) {
            return res
                .status(400)
                .json(new ApiResponse(400, null, 'This plan is free — use the upgrade endpoint instead.'));
        }

        const razorpay = getRazorpayClient();
        if (!razorpay) {
            return res
                .status(503)
                .json(new ApiResponse(503, null, 'Payment gateway is not configured on this server.'));
        }

        const store = await Store.findById(req.tenantId);
        if (!store) return res.status(404).json(new ApiResponse(404, null, 'Store not found'));

        const now = new Date();
        const billingEnd = new Date(now);
        billingEnd.setDate(billingEnd.getDate() + (plan.billingCycle === 'yearly' ? 365 : 30));

        const invoice = await SubscriptionInvoice.create({
            invoiceNumber: `INV-${Date.now()}`,
            storeId: store._id,
            ownerId: store.owner,
            plan: plan._id,
            amount: plan.price,
            taxAmount: 0,
            totalAmount: plan.price,
            currency: 'INR',
            status: 'Sent',
            dueDate: now,
            billingPeriod: { start: now, end: billingEnd },
        });

        let razorpayOrder;
        try {
            razorpayOrder = await razorpay.orders.create({
                amount: Math.round(plan.price * 100), // paise
                currency: 'INR',
                receipt: invoice.invoiceNumber,
                notes: {
                    storeId: store._id.toString(),
                    planId: plan._id.toString(),
                    invoiceId: (invoice._id as any).toString(),
                },
            });
        } catch (err: any) {
            await SubscriptionInvoice.findByIdAndDelete(invoice._id);
            return res
                .status(502)
                .json(
                    new ApiResponse(
                        502,
                        null,
                        `Payment gateway rejected the checkout request: ${err.error?.description || err.message || 'unknown error'}`
                    )
                );
        }

        await SubscriptionPayment.create({
            transactionId: razorpayOrder.id,
            invoiceId: invoice._id,
            storeId: store._id,
            amount: plan.price,
            currency: 'INR',
            gateway: 'Razorpay',
            status: 'Pending',
            paymentMethod: 'razorpay_checkout',
        });

        res.status(200).json(
            new ApiResponse(
                200,
                {
                    razorpayOrderId: razorpayOrder.id,
                    amount: razorpayOrder.amount,
                    currency: razorpayOrder.currency,
                    keyId: process.env.RAZORPAY_KEY_ID,
                    invoiceId: invoice._id,
                    planName: plan.name,
                },
                'Checkout order created'
            )
        );
    }),

    // @desc    Get platform-wide invoices (Super Admin)
    getSystemInvoices: asyncHandler(async (req: TenantRequest, res: Response) => {
        const { page = 1, limit = 20 } = req.query;
        const invoices = await SubscriptionInvoice.find()
            .populate('storeId', 'name')
            .populate('ownerId', 'name email')
            .sort({ createdAt: -1 })
            .limit(Number(limit))
            .skip((Number(page) - 1) * Number(limit));

        const total = await SubscriptionInvoice.countDocuments();

        res.status(200).json(
            new ApiResponse(200, {
                invoices,
                total,
                totalPages: Math.ceil(total / Number(limit)),
            })
        );
    }),
};
