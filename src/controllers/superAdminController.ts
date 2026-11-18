import { Response } from 'express';
import mongoose from 'mongoose';
import { TenantRequest } from '../middleware/tenantHandler.js';
import Store from '../models/Store.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import Product from '../models/Product.js';
import SubscriptionPayment from '../models/SubscriptionPayment.js';
import SubscriptionInvoice from '../models/SubscriptionInvoice.js';
import { BILLING_CYCLES, BillingCycle, PLAN_LABELS, planDurationDays } from '../utils/planDuration.js';
import Plan from '../models/Plan.js';
import Customer from '../models/Customer.js';
import dayjs from 'dayjs';
import ApiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { notificationService } from '../services/notificationService.js';
import redisClient from '../config/redis.js';
import { reportQueue } from '../queues/reportQueue.js';
import { notificationQueue } from '../queues/notificationQueue.js';

// @desc    Get system-wide stats for Super Admin
// @route   GET /api/v1/super-admin/stats
export const getSystemStats = asyncHandler(async (req: TenantRequest, res: Response) => {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [totalStores, totalOrders, totalUsers, stores, aggregateRevenue, monthlyRevenue, planBreakdown] =
        await Promise.all([
            Store.countDocuments(),
            Order.countDocuments(),
            User.countDocuments(),
            Store.find().populate('subscriptionPlan').limit(10).sort({ createdAt: -1 }),
            // The platform's own revenue is what tenants pay for their subscriptions — never the
            // sales the tenants make to their own customers.
            SubscriptionPayment.aggregate([
                { $match: { status: 'Completed' } },
                { $group: { _id: null, total: { $sum: '$amount' } } },
            ]),
            SubscriptionPayment.aggregate([
                { $match: { status: 'Completed', createdAt: { $gte: startOfMonth } } },
                { $group: { _id: null, total: { $sum: '$amount' } } },
            ]),
            // Revenue per plan (7-day trial, 1 month, 3 months ...) from paid subscription invoices.
            SubscriptionInvoice.aggregate([
                { $match: { status: 'Paid' } },
                { $group: { _id: '$plan', revenue: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
                { $lookup: { from: 'plans', localField: '_id', foreignField: '_id', as: 'plan' } },
                { $unwind: { path: '$plan', preserveNullAndEmptyArrays: true } },
                {
                    $project: {
                        _id: 0,
                        name: { $ifNull: ['$plan.name', 'Removed plan'] },
                        billingCycle: '$plan.billingCycle',
                        revenue: 1,
                        count: 1,
                    },
                },
                { $sort: { revenue: -1 } },
            ]),
        ]);

    res.status(200).json(
        new ApiResponse(200, {
            totalStores,
            totalOrders,
            totalUsers,
            totalRevenue: aggregateRevenue[0]?.total || 0,
            monthlyRevenue: monthlyRevenue[0]?.total || 0,
            planBreakdown,
            recentStores: stores,
        })
    );
});

// @desc    Get all stores (Tenants)
// @route   GET /api/v1/super-admin/stores
export const getAllStores = asyncHandler(async (req: TenantRequest, res: Response) => {
    const { page = 1, limit = 10, search = '', status = '', plan = '' } = req.query;

    const query: Record<string, any> = {};
    if (search) query.name = { $regex: search as string, $options: 'i' };
    // Store.status is the Pending/Approved/Suspended lifecycle field shown as the
    // "Status" badge on the tenants table — the most useful single filter here.
    // "Trial" is an approved tenant that is still on its trial.
    if (status === 'Trial') {
        query.status = 'Approved';
        query.subscriptionStatus = 'Trialing';
    } else if (status) query.status = status as string;
    if (plan && BILLING_CYCLES.includes(plan as BillingCycle)) {
        // The plan filter lists the durations (7 Days Trial, 1 Month ... 2 Years).
        const ids = await Plan.find({ billingCycle: plan as string }).distinct('_id');
        query.subscriptionPlan = { $in: ids };
    } else if (plan && mongoose.Types.ObjectId.isValid(plan as string)) query.subscriptionPlan = plan as string;

    const stores = await Store.find(query)
        .populate('owner', 'name email phone')
        .populate('subscriptionPlan')
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit))
        .sort({ createdAt: -1 });

    const total = await Store.countDocuments(query);

    res.status(200).json(
        new ApiResponse(200, {
            stores,
            totalPages: Math.ceil(total / Number(limit)),
            currentPage: Number(page),
            totalTenants: total,
        })
    );
});

// @desc    Per-tenant analytics drill-down (previously only an aggregate platform-wide
//          view and a flat tenant list existed — no way to inspect a single tenant)
// @route   GET /api/v1/super-admin/stores/:id/analytics
export const getTenantAnalytics = asyncHandler(async (req: TenantRequest, res: Response) => {
    const store = await Store.findById(req.params.id)
        .populate('owner', 'name email phone')
        .populate('subscriptionPlan');
    if (!store) return res.status(404).json(new ApiResponse(404, null, 'Store not found'));

    const startOfMonth = dayjs().startOf('month').toDate();
    const thirtyDaysAgo = dayjs().subtract(30, 'days').startOf('day').toDate();

    const [
        totalOrders,
        monthlyOrders,
        totalProducts,
        totalCustomers,
        totalEmployees,
        revenueAgg,
        monthlyRevenueAgg,
        recentOrders,
        dailyRevenue,
        recentActivity,
    ] = await Promise.all([
        Order.countDocuments({ storeId: store._id }),
        Order.countDocuments({ storeId: store._id, createdAt: { $gte: startOfMonth } }),
        Product.countDocuments({ storeId: store._id }),
        Customer.countDocuments({ storeId: store._id }),
        User.countDocuments({ storeId: store._id }),
        Order.aggregate([
            { $match: { storeId: store._id, status: 'Completed' } },
            { $group: { _id: null, total: { $sum: '$grandTotal' } } },
        ]),
        Order.aggregate([
            { $match: { storeId: store._id, status: 'Completed', createdAt: { $gte: startOfMonth } } },
            { $group: { _id: null, total: { $sum: '$grandTotal' } } },
        ]),
        Order.find({ storeId: store._id })
            .sort({ createdAt: -1 })
            .limit(10)
            .select('orderNumber grandTotal status createdAt'),
        Order.aggregate([
            { $match: { storeId: store._id, status: 'Completed', createdAt: { $gte: thirtyDaysAgo } } },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    total: { $sum: '$grandTotal' },
                },
            },
            { $sort: { _id: 1 } },
        ]),
        AuditLog.find({ storeId: store._id }).populate('userId', 'name').sort({ createdAt: -1 }).limit(15),
    ]);

    res.status(200).json(
        new ApiResponse(200, {
            store,
            totalOrders,
            monthlyOrders,
            totalProducts,
            totalCustomers,
            totalEmployees,
            totalRevenue: revenueAgg[0]?.total || 0,
            monthlyRevenue: monthlyRevenueAgg[0]?.total || 0,
            recentOrders,
            dailyRevenue: dailyRevenue.map((d: any) => ({ date: d._id, total: d.total })),
            recentActivity,
        })
    );
});

// @desc    Toggle store active status (Suspend/Reactivate)
// @route   PUT /api/v1/super-admin/stores/:id/status
export const toggleStoreStatus = asyncHandler(async (req: TenantRequest, res: Response) => {
    const store = await Store.findById(req.params.id);
    if (!store) return res.status(404).json(new ApiResponse(404, null, 'Store not found'));

    store.isActive = !store.isActive;
    store.status = store.isActive ? 'Approved' : 'Suspended';
    await store.save();

    res.status(200).json(new ApiResponse(200, store, `Store ${store.isActive ? 'Reactivated' : 'Suspended'}`));
});

// @desc    Change a tenant's subscription plan (upgrade/downgrade) without checkout
// @route   PUT /api/v1/super-admin/stores/:id/plan
export const changeStorePlan = asyncHandler(async (req: TenantRequest, res: Response) => {
    // The Super Admin picks a duration (7-day trial ... 2 years) and types the amount for this
    // tenant. `planId` is still accepted for older clients.
    const { planId, duration } = req.body;
    const hasDuration = duration !== undefined && duration !== null && duration !== '';
    if (hasDuration && !BILLING_CYCLES.includes(duration)) {
        return res.status(400).json(new ApiResponse(400, null, 'Choose a valid plan duration'));
    }
    if (!hasDuration && (!planId || !mongoose.Types.ObjectId.isValid(planId))) {
        return res.status(400).json(new ApiResponse(400, null, 'A plan duration is required'));
    }
    const typedAmount = Number(req.body.amount);
    if (hasDuration && (req.body.amount === undefined || req.body.amount === '' || !(typedAmount >= 0))) {
        return res.status(400).json(new ApiResponse(400, null, 'Enter the amount for this plan'));
    }

    const store = await Store.findById(req.params.id).populate('subscriptionPlan');
    if (!store) return res.status(404).json(new ApiResponse(404, null, 'Store not found'));

    let plan: any;
    if (hasDuration) {
        // One hidden plan per duration carries the label; the price is the amount typed for this tenant.
        const cycle = duration as BillingCycle;
        plan = await Plan.findOne({ name: PLAN_LABELS[cycle], billingCycle: cycle });
        if (!plan) {
            plan = await Plan.create({
                name: PLAN_LABELS[cycle],
                price: 0,
                billingCycle: cycle,
                maxUsers: 0,
                maxStores: 0,
                maxProducts: 0,
                features: [
                    'POS Access',
                    'Inventory Management',
                    'Basic Analytics',
                    'Advanced Finance',
                    'AI Predictions',
                    'White-labeling',
                ],
                isActive: false, // not offered for self-service checkout
            });
        }
    } else {
        plan = await Plan.findById(planId);
        if (!plan) return res.status(404).json(new ApiResponse(404, null, 'Plan not found'));
    }
    const amount = hasDuration ? typedAmount : plan.price;

    const oldName = (store.subscriptionPlan as any)?.name || 'Trial';
    const now = new Date();
    store.subscriptionPlan = plan._id as any;
    if (plan.billingCycle === 'trial') {
        store.subscriptionStatus = 'Trialing';
        store.trialEndsAt = dayjs(now).add(planDurationDays(plan.billingCycle), 'day').toDate();
    } else {
        store.subscriptionStatus = 'Active';
    }
    store.lastBillingDate = now;
    // Setting a plan for a tenant also makes it Active and Approved.
    store.status = 'Approved';
    store.isActive = true;
    await store.save();

    // A plan the Super Admin sets up (e.g. after taking payment offline) counts as platform
    // revenue, so it shows on the Super Admin dashboard like any other subscription payment.
    if (amount > 0) {
        const periodEnd = dayjs(now).add(planDurationDays(plan.billingCycle), 'day').toDate();
        const invoice = await SubscriptionInvoice.create({
            invoiceNumber: `INV-${Date.now()}`,
            storeId: store._id,
            ownerId: store.owner,
            plan: plan._id,
            amount,
            taxAmount: 0,
            totalAmount: amount,
            currency: 'INR',
            status: 'Paid',
            dueDate: now,
            paidAt: now,
            billingPeriod: { start: now, end: periodEnd },
        });
        await SubscriptionPayment.create({
            transactionId: `MANUAL-${Date.now()}-${store._id}`,
            invoiceId: invoice._id,
            storeId: store._id,
            amount,
            currency: 'INR',
            gateway: 'Manual',
            status: 'Completed',
            paymentMethod: 'manual',
        });
    }

    await AuditLog.create({
        userId: req.user?._id,
        storeId: store._id,
        action: 'PLAN_CHANGED',
        entity: 'Store',
        entityId: store._id,
        details: `Super admin changed plan from ${oldName} to ${plan.name} (₹${amount})`,
    });

    await notificationService
        .send({
            recipientId: store.owner as any,
            storeId: store._id as any,
            title: 'Subscription updated',
            message: `Your plan has been changed to ${plan.name}.`,
            type: 'INFO',
        })
        .catch(() => undefined);

    await store.populate('subscriptionPlan');
    res.status(200).json(new ApiResponse(200, store, `Plan changed to ${plan.name}`));
});

// @desc    Approve/Reject store registration
// @route   PUT /api/v1/super-admin/stores/:id/approve
export const approveStore = asyncHandler(async (req: TenantRequest, res: Response) => {
    const { approve } = req.body;
    const store = await Store.findById(req.params.id).populate('subscriptionPlan');
    if (!store) return res.status(404).json(new ApiResponse(404, null, 'Store not found'));

    if (approve) {
        store.status = 'Approved';
        store.isActive = true;
        // An approved tenant has full access; only the 7-day trial plan (set via Change Plan) is limited.
        if (store.subscriptionStatus === 'Trialing' && (store.subscriptionPlan as any)?.billingCycle !== 'trial') {
            store.subscriptionStatus = 'Active';
        }
    } else {
        // Rejection could delete or just mark as suspended/rejected
        store.status = 'Suspended';
        store.isActive = false;
    }

    await store.save();

    res.status(200).json(new ApiResponse(200, store, `Store ${approve ? 'Approved' : 'Rejected'}`));
});

// @desc    Get Platform Audit Logs
// @route   GET /api/v1/super-admin/audit-logs
export const getSystemAuditLogs = asyncHandler(async (req: TenantRequest, res: Response) => {
    const { page = 1, limit = 20, action = '', entity = '', startDate = '', endDate = '', search = '' } = req.query;

    const query: Record<string, any> = {};
    if (action) query.action = action as string;
    if (entity) query.entity = entity as string;
    if (startDate || endDate) {
        query.createdAt = {};
        if (startDate)
            query.createdAt.$gte = dayjs(startDate as string)
                .startOf('day')
                .toDate();
        if (endDate)
            query.createdAt.$lte = dayjs(endDate as string)
                .endOf('day')
                .toDate();
    }

    // Free-text search matches the populated store name or user name. AuditLog has no
    // direct text field for either, so resolve matching store/user ids first (two-step
    // lookup) rather than reaching for a $lookup aggregation for what's a small filter.
    if (search) {
        const term = search as string;
        const [matchingStores, matchingUsers] = await Promise.all([
            Store.find({ name: { $regex: term, $options: 'i' } }).select('_id'),
            User.find({ name: { $regex: term, $options: 'i' } }).select('_id'),
        ]);
        const storeIds = matchingStores.map((s) => s._id);
        const userIds = matchingUsers.map((u) => u._id);
        if (storeIds.length === 0 && userIds.length === 0) {
            // No store/user matches this term — short-circuit to an empty page rather
            // than falling through to an unfiltered query.
            return res.status(200).json(
                new ApiResponse(200, {
                    logs: [],
                    totalPages: 0,
                    currentPage: Number(page),
                    distinctActions: [],
                    distinctEntities: [],
                })
            );
        }
        query.$or = [
            ...(storeIds.length ? [{ storeId: { $in: storeIds } }] : []),
            ...(userIds.length ? [{ userId: { $in: userIds } }] : []),
        ];
    }

    const [logs, total, distinctActions, distinctEntities] = await Promise.all([
        AuditLog.find(query)
            .populate('userId', 'name email')
            .populate('storeId', 'name')
            .sort({ createdAt: -1 })
            .limit(Number(limit))
            .skip((Number(page) - 1) * Number(limit)),
        AuditLog.countDocuments(query),
        AuditLog.distinct('action'),
        AuditLog.distinct('entity'),
    ]);

    res.status(200).json(
        new ApiResponse(200, {
            logs,
            totalPages: Math.ceil(total / Number(limit)),
            currentPage: Number(page),
            distinctActions,
            distinctEntities,
        })
    );
});

// @desc    System health for Super Admin — infrastructure/integration status, not
//          business metrics (those already exist in getSystemStats).
// @route   GET /api/v1/super-admin/health
export const getSystemHealth = asyncHandler(async (req: TenantRequest, res: Response) => {
    const mongoStateNames = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    const mongoStatus = mongoStateNames[mongoose.connection.readyState] || 'unknown';

    const redisConfigured = process.env.SKIP_REDIS !== 'true';
    const redisStatus = !redisConfigured ? 'disabled' : redisClient.isReady ? 'connected' : 'disconnected';

    const [reportQueueCounts, notificationQueueCounts] = await Promise.all([
        reportQueue ? reportQueue.getJobCounts().catch(() => null) : Promise.resolve(null),
        notificationQueue ? notificationQueue.getJobCounts().catch(() => null) : Promise.resolve(null),
    ]);

    res.status(200).json(
        new ApiResponse(200, {
            server: {
                status: 'ok',
                uptimeSeconds: Math.floor(process.uptime()),
                nodeVersion: process.version,
                environment: process.env.NODE_ENV || 'development',
            },
            database: { status: mongoStatus },
            redis: { status: redisStatus, configured: redisConfigured },
            queues: {
                reportGeneration: reportQueueCounts,
                notifications: notificationQueueCounts,
            },
            integrations: {
                sentry: !!process.env.SENTRY_DSN,
                razorpay: !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
                stripe: !!process.env.STRIPE_SECRET_KEY,
                twilioSms: !!(
                    process.env.TWILIO_ACCOUNT_SID &&
                    process.env.TWILIO_AUTH_TOKEN &&
                    process.env.TWILIO_PHONE_NUMBER
                ),
                twilioWhatsapp: !!(
                    process.env.TWILIO_ACCOUNT_SID &&
                    process.env.TWILIO_AUTH_TOKEN &&
                    process.env.TWILIO_WHATSAPP_NUMBER
                ),
                smtp: !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
                cloudinary: !!(
                    process.env.CLOUDINARY_CLOUD_NAME &&
                    process.env.CLOUDINARY_API_KEY &&
                    process.env.CLOUDINARY_API_SECRET
                ),
                s3Backups: !!(
                    process.env.AWS_ACCESS_KEY_ID &&
                    process.env.AWS_SECRET_ACCESS_KEY &&
                    process.env.AWS_S3_BUCKET
                ),
            },
        })
    );
});

// @desc    Broadcast notification to all active store owners
// @route   POST /api/v1/super-admin/broadcast
export const broadcastNotification = asyncHandler(async (req: TenantRequest, res: Response) => {
    const { title, message, type = 'INFO' } = req.body;

    if (!title || !message) {
        return res.status(400).json(new ApiResponse(400, null, 'Title and message are required'));
    }

    // Find all store owners
    const owners = await User.find({ role: 'STORE_OWNER', isActive: true });

    // Use notificationService to send to each
    const notificationPromises = owners.map((owner) =>
        notificationService.send({
            recipientId: owner._id as any,
            storeId: owner.storeId as any, // Most owners have a primary storeId
            title: `[SYSTEM] ${title}`,
            message,
            type,
        })
    );

    await Promise.all(notificationPromises);

    res.status(200).json(new ApiResponse(200, null, `Broadcast sent to ${owners.length} owners`));
});

// @desc    Send a notification to a single tenant's owner — previously Super Admin
//          could only broadcast to every store owner at once, with no way to message
//          one tenant directly.
// @route   POST /api/v1/super-admin/stores/:id/notify
export const sendTenantNotification = asyncHandler(async (req: TenantRequest, res: Response) => {
    const { title, message, type = 'INFO' } = req.body;

    if (!title || !message) {
        return res.status(400).json(new ApiResponse(400, null, 'Title and message are required'));
    }

    const store = await Store.findById(req.params.id);
    if (!store) return res.status(404).json(new ApiResponse(404, null, 'Store not found'));

    await notificationService.send({
        recipientId: store.owner as any,
        storeId: store._id as any,
        title: `[SUPPORT] ${title}`,
        message,
        type,
    });

    res.status(200).json(new ApiResponse(200, null, `Message sent to ${store.name}'s owner`));
});
