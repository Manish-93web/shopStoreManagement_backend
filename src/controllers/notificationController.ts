import { Response } from 'express';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { TenantRequest } from '../middleware/tenantHandler.js';
import { notificationService } from '../services/notificationService.js';

export const notificationController = {
    getNotifications: async (req: TenantRequest, res: Response) => {
        try {
            const notifications = await Notification.find({
                recipient: req.user?._id,
                storeId: req.tenantId
            }).sort({ createdAt: -1 }).limit(50);
            res.json({ success: true, data: notifications });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    },

    markAsRead: async (req: TenantRequest, res: Response) => {
        try {
            await Notification.updateMany(
                { recipient: req.user?._id, isRead: false },
                { $set: { isRead: true } }
            );
            res.json({ success: true, message: "All notifications marked as read" });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    },

    getSettings: async (req: TenantRequest, res: Response) => {
        try {
            const user = await User.findById(req.user?._id).select('notificationSettings');
            res.json({ success: true, data: user?.notificationSettings });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    },

    updateSettings: async (req: TenantRequest, res: Response) => {
        try {
            const { inApp, email, sms, whatsapp } = req.body;
            await User.findByIdAndUpdate(req.user?._id, {
                $set: {
                    notificationSettings: { inApp, email, sms, whatsapp }
                }
            });
            res.json({ success: true, message: "Notification settings updated" });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    },

    // Bridge for manual triggers if needed via API
    sendManual: async (req: TenantRequest, res: Response) => {
        try {
            const { recipientId, title, message, type, actionUrl } = req.body;
            await notificationService.send({
                recipientId,
                storeId: req.tenantId!,
                title,
                message,
                type,
                actionUrl
            });
            res.json({ success: true, message: "Notification queued" });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
};
