import Notification from '../models/Notification.js';
import nodemailer from 'nodemailer';
import twilio from 'twilio';
// Initialize stubs
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID || 'AC_STUB', process.env.TWILIO_AUTH_TOKEN || 'TOKEN_STUB');
export const notificationController = {
    getNotifications: async (req, res) => {
        try {
            const notifications = await Notification.find({
                recipient: req.user?._id,
                storeId: req.tenantId
            }).sort({ createdAt: -1 }).limit(50);
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
    // Utility for internal and external triggers
    sendNotification: async (data) => {
        const channels = data.channels || ['In-App'];
        // 1. In-App Notification
        if (channels.includes('In-App')) {
            const notification = new Notification({
                recipient: data.recipient,
                storeId: data.storeId,
                title: data.title,
                message: data.message,
                type: data.type || 'INFO',
                channels: ['In-App']
            });
            await notification.save();
        }
        // 2. Email Notification
        if (channels.includes('Email') && data.recipientEmail) {
            try {
                await transporter.sendMail({
                    from: '"RetailSync Pro" <alerts@retailsync.com>',
                    to: data.recipientEmail,
                    subject: data.title,
                    text: data.message
                });
            }
            catch (err) {
                console.error("Email failed:", err);
            }
        }
        // 3. SMS Notification
        if (channels.includes('SMS') && data.recipientPhone) {
            try {
                await twilioClient.messages.create({
                    body: `${data.title}: ${data.message}`,
                    from: process.env.TWILIO_PHONE_NUMBER,
                    to: data.recipientPhone
                });
            }
            catch (err) {
                console.error("SMS failed:", err);
            }
        }
    }
};
