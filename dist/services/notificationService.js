import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { sendEmail } from '../utils/emailService.js';
import { sendSMS } from '../utils/smsService.js';
import { sendWhatsApp } from '../utils/whatsappService.js';
import { addNotificationJob } from '../queues/notificationQueue.js';
export const notificationService = {
    send: async (payload) => {
        try {
            const user = await User.findById(payload.recipientId);
            if (!user)
                return false;
            const settings = user.notificationSettings || {
                inApp: true,
                email: true,
                sms: false,
                whatsapp: false
            };
            const channelsToSend = [];
            // Determine channels based on user settings and forced overrides
            if (payload.forcedChannels) {
                channelsToSend.push(...payload.forcedChannels);
            }
            else {
                if (settings.inApp)
                    channelsToSend.push('In-App');
                if (settings.email && user.email)
                    channelsToSend.push('Email');
                if (settings.sms && user.phone)
                    channelsToSend.push('SMS');
                if (settings.whatsapp && user.phone)
                    channelsToSend.push('WhatsApp');
            }
            // 1. Save to Database (Internal Log/In-App)
            const notification = new Notification({
                recipient: payload.recipientId,
                storeId: payload.storeId,
                title: payload.title,
                message: payload.message,
                type: payload.type || 'INFO',
                actionUrl: payload.actionUrl,
                metadata: payload.metadata,
                channels: channelsToSend,
                isRead: false
            });
            await notification.save();
            // 2. External Deliveries
            const deliveryPromises = [];
            if (channelsToSend.includes('Email') && user.email) {
                deliveryPromises.push(sendEmail({
                    to: user.email,
                    subject: payload.title,
                    html: `<div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                        <h2 style="color: #6366f1;">${payload.title}</h2>
                        <p>${payload.message}</p>
                        ${payload.actionUrl ? `<a href="${payload.actionUrl}" style="display: inline-block; padding: 10px 20px; background: #6366f1; color: white; text-decoration: none; border-radius: 5px;">View Details</a>` : ''}
                    </div>`
                }));
            }
            if (channelsToSend.includes('SMS') && user.phone) {
                deliveryPromises.push(sendSMS({
                    to: user.phone,
                    body: `${payload.title}: ${payload.message}`
                }));
            }
            if (channelsToSend.includes('WhatsApp') && user.phone) {
                deliveryPromises.push(sendWhatsApp({
                    to: user.phone,
                    body: `*${payload.title}*\n\n${payload.message}`
                }));
            }
            await Promise.all(deliveryPromises);
            return true;
        }
        catch (error) {
            console.error("Notification Service Error:", error);
            return false;
        }
    },
    queueSend: async (payload) => {
        try {
            await addNotificationJob(payload);
            return true;
        }
        catch (error) {
            console.error("Queue Notification Failed:", error);
            return false;
        }
    },
    broadcastToStore: async (storeId, title, message, type = 'INFO') => {
        const users = await User.find({ storeId, isActive: true });
        const promises = users.map(user => notificationService.send({
            recipientId: user._id.toString(),
            storeId,
            title,
            message,
            type
        }));
        await Promise.all(promises);
    }
};
