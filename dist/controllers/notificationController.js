import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { notificationService } from '../services/notificationService.js';
export const notificationController = {
    getNotifications: async (req, res) => {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 50;
            const skip = (page - 1) * limit;
            const type = req.query.type?.trim();
            const isReadParam = req.query.isRead?.trim();
            const startDate = req.query.startDate;
            const endDate = req.query.endDate;
            const query = { recipient: req.user?._id };
            if (req.tenantId && req.tenantId !== 'undefined' && req.tenantId !== 'null') {
                query.storeId = req.tenantId;
            }
            if (type && ['INFO', 'WARNING', 'ERROR', 'SUCCESS'].includes(type)) {
                query.type = type;
            }
            if (isReadParam === 'true' || isReadParam === 'false') {
                query.isRead = isReadParam === 'true';
            }
            if (startDate && endDate) {
                query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
            }
            const [notifications, total] = await Promise.all([
                Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
                Notification.countDocuments(query),
            ]);
            res.json({
                success: true,
                data: {
                    notifications,
                    pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 },
                },
            });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    },
    markAsRead: async (req, res) => {
        try {
            await Notification.updateMany({ recipient: req.user?._id, isRead: false }, { $set: { isRead: true } });
            res.json({ success: true, message: 'All notifications marked as read' });
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
                    notificationSettings: { inApp, email, sms, whatsapp },
                },
            });
            res.json({ success: true, message: 'Notification settings updated' });
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
                actionUrl,
            });
            res.json({ success: true, message: 'Notification queued' });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    },
};
