import { Response } from 'express';
import Store from '../models/Store.js';
import Plan from '../models/Plan.js';
import SubscriptionInvoice from '../models/SubscriptionInvoice.js';
import SubscriptionPayment from '../models/SubscriptionPayment.js';
import { TenantRequest } from '../middleware/tenantHandler.js';
import ApiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

export const subscriptionController = {
    // @desc    Get current subscription plan for a tenant
    getSubscription: asyncHandler(async (req: TenantRequest, res: Response) => {
        const store = await Store.findById(req.tenantId).populate('subscriptionPlan');
        if (!store) return res.status(404).json(new ApiResponse(404, null, "Store not found"));
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
        res.status(201).json(new ApiResponse(201, plan, "Plan created successfully"));
    }),

    // @desc    Upgrade/Change plan
    upgradePlan: asyncHandler(async (req: TenantRequest, res: Response) => {
        const { planId } = req.body;
        const plan = await Plan.findById(planId);
        if (!plan) return res.status(404).json(new ApiResponse(404, null, "Plan not found"));

        const store = await Store.findByIdAndUpdate(
            req.tenantId,
            {
                $set: {
                    subscriptionPlan: plan._id,
                    subscriptionStatus: 'Active',
                    lastBillingDate: new Date()
                }
            },
            { new: true }
        );

        res.status(200).json(new ApiResponse(200, store, "Subscription updated"));
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

        res.status(200).json(new ApiResponse(200, {
            invoices,
            total,
            totalPages: Math.ceil(total / Number(limit))
        }));
    })
};
