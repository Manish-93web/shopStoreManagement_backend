import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { notificationService } from '../services/notificationService.js';
export const notificationController = {
    getNotifications: async (req, res) => {
        try {
            const query = { recipient: req.user?._id };
            if (req.tenantId && req.tenantId !== 'undefined' && req.tenantId !== 'null') {
                query.storeId = req.tenantId;
            }
            const notifications = await Notification.find(query)
                .sort({ createdAt: -1 })
                .limit(50);
            res.json({ success: true, data: notifications });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    },
    markAsRead: async (req, res) => {
        try {
            await Notification.updateMany({ recipient: req.user?._id, isRead: false }, { $set: { isRead: true } });
            res.json({ success: true, message: "All notifications marked as read" });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    },
    getSettings: async (req, res) => {
        try {
            const user = await User.findById(req.user?._id).select('notificationSettings');
            res.json({ success: true, data: user?.notificationSettings });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    },
    updateSettings: async (req, res) => {
        try {
            const { inApp, email, sms, whatsapp } = req.body;
            await User.findByIdAndUpdate(req.user?._id, {
                $set: {
                    notificationSettings: { inApp, email, sms, whatsapp }
                }
            });
            res.json({ success: true, message: "Notification settings updated" });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    },
    // Bridge for manual triggers if needed via API
    sendManual: async (req, res) => {
        try {
            const { recipientId, title, message, type, actionUrl } = req.body;
            await notificationService.send({
                recipientId,
                storeId: req.tenantId,
                title,
                message,
                type,
                actionUrl
            });
            res.json({ success: true, message: "Notification queued" });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
};
