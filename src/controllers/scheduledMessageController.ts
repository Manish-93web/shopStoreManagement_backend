import { Response } from 'express';
import ScheduledMessage from '../models/ScheduledMessage.js';
import AuditLog from '../models/AuditLog.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/apiResponse.js';
import { TenantRequest } from '../middleware/tenantHandler.js';

// @desc    Schedule a WhatsApp reminder — the message text is locked in now
//          (server-authoritative snapshot), so it doesn't drift if e.g. the
//          customer's due balance changes before the reminder actually fires.
// @route   POST /api/scheduled-messages
export const createScheduledMessage = asyncHandler(async (req: TenantRequest, res: Response) => {
    const { customerId, orderId, templateLabel, language, message, phone, scheduledFor } = req.body;

    if (!customerId || !templateLabel || !message || !phone || !scheduledFor) {
        return res.status(400).json(new ApiResponse(400, null, 'Missing required fields'));
    }
    if (new Date(scheduledFor).getTime() <= Date.now()) {
        return res.status(400).json(new ApiResponse(400, null, 'Scheduled time must be in the future'));
    }

    const scheduled = await ScheduledMessage.create({
        storeId: req.tenantId,
        customer: customerId,
        order: orderId || undefined,
        templateLabel,
        language: language || 'en',
        message,
        phone,
        scheduledFor,
        createdBy: req.user?._id,
    });

    res.status(201).json(new ApiResponse(201, scheduled, 'Reminder scheduled'));
});

// @desc    List scheduled messages for the store
// @route   GET /api/scheduled-messages
export const getScheduledMessages = asyncHandler(async (req: TenantRequest, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    const status = (req.query.status as string)?.trim();

    const query: any = { storeId: req.tenantId };
    if (status) query.status = status;

    const messages = await ScheduledMessage.find(query)
        .populate('customer', 'name phone')
        .sort({ scheduledFor: 1 })
        .skip(skip)
        .limit(limit);
    const total = await ScheduledMessage.countDocuments(query);

    res.status(200).json(
        new ApiResponse(200, {
            messages,
            pagination: { total, page, limit, pages: Math.ceil(total / limit) },
        })
    );
});

// @desc    Cancel a pending reminder
// @route   PUT /api/scheduled-messages/:id/cancel
export const cancelScheduledMessage = asyncHandler(async (req: TenantRequest, res: Response) => {
    const scheduled = await ScheduledMessage.findOne({ _id: req.params.id, storeId: req.tenantId });
    if (!scheduled) {
        return res.status(404).json(new ApiResponse(404, null, 'Scheduled message not found'));
    }
    if (scheduled.status !== 'Pending' && scheduled.status !== 'Due') {
        return res.status(400).json(new ApiResponse(400, null, 'Only a pending reminder can be cancelled'));
    }
    scheduled.status = 'Cancelled';
    await scheduled.save();
    res.status(200).json(new ApiResponse(200, scheduled, 'Reminder cancelled'));
});

// @desc    Mark a due reminder as actually sent (called right after the owner
//          clicks through to WhatsApp) — logs it to the customer's Activity Log,
//          same pattern as orderController.logWhatsAppSent.
// @route   PUT /api/scheduled-messages/:id/mark-sent
export const markScheduledMessageSent = asyncHandler(async (req: TenantRequest, res: Response) => {
    const scheduled = await ScheduledMessage.findOne({ _id: req.params.id, storeId: req.tenantId });
    if (!scheduled) {
        return res.status(404).json(new ApiResponse(404, null, 'Scheduled message not found'));
    }
    scheduled.status = 'Sent';
    scheduled.sentAt = new Date();
    await scheduled.save();

    await AuditLog.create({
        userId: req.user?._id,
        storeId: req.tenantId,
        action: 'WHATSAPP_SENT',
        entity: 'Customer',
        entityId: scheduled.customer,
        details: `Sent scheduled "${scheduled.templateLabel}" message`,
    });

    res.status(200).json(new ApiResponse(200, scheduled, 'Marked as sent'));
});
