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
                whatsapp: false,
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
            // Notification.type is a strict uppercase enum — normalize here so any
            // caller passing a lowercase/mixed-case type (e.g. the common web 'info'
            // convention) doesn't silently fail schema validation. This previously
            // failed silently: the validation error was swallowed by the catch below
            // and callers (e.g. the broadcast/tenant-notify endpoints) reported success
            // to the API even though no Notification document was ever created.
            const VALID_TYPES = ['INFO', 'WARNING', 'ERROR', 'SUCCESS'];
            const normalizedType = payload.type?.toUpperCase();
            const notification = new Notification({
                recipient: payload.recipientId,
                storeId: payload.storeId,
                title: payload.title,
                message: payload.message,
                type: normalizedType && VALID_TYPES.includes(normalizedType) ? normalizedType : 'INFO',
                actionUrl: payload.actionUrl,
                metadata: payload.metadata,
                channels: channelsToSend,
                isRead: false,
            });
            await notification.save();
            // 2. External Deliveries — tracked per-channel (previously fire-and-forget
            // with no record of which channels actually succeeded vs. silently failed).
            const deliveryStatus = [
                { channel: 'In-App', success: true },
            ];
            const deliveries = [];
            if (channelsToSend.includes('Email') && user.email) {
                deliveries.push({
                    channel: 'Email',
                    promise: sendEmail({
                        to: user.email,
                        subject: payload.title,
                        html: `<div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                            <h2 style="color: #6366f1;">${payload.title}</h2>
                            <p>${payload.message}</p>
                            ${payload.actionUrl ? `<a href="${payload.actionUrl}" style="display: inline-block; padding: 10px 20px; background: #6366f1; color: white; text-decoration: none; border-radius: 5px;">View Details</a>` : ''}
                        </div>`,
                    }),
                });
            }
            if (channelsToSend.includes('SMS') && user.phone) {
                deliveries.push({
                    channel: 'SMS',
                    promise: sendSMS({ to: user.phone, body: `${payload.title}: ${payload.message}` }),
                });
            }
            if (channelsToSend.includes('WhatsApp') && user.phone) {
                deliveries.push({
                    channel: 'WhatsApp',
                    promise: sendWhatsApp({ to: user.phone, body: `*${payload.title}*\n\n${payload.message}` }),
                });
            }
            const results = await Promise.allSettled(deliveries.map((d) => d.promise));
            results.forEach((result, i) => {
                deliveryStatus.push({
                    channel: deliveries[i].channel,
                    success: result.status === 'fulfilled' && result.value === true,
                });
            });
            if (deliveries.length > 0) {
                await Notification.findByIdAndUpdate(notification._id, { deliveryStatus });
            }
            return true;
        }
        catch (error) {
            console.error('Notification Service Error:', error);
            return false;
        }
    },
    queueSend: async (payload) => {
        try {
            await addNotificationJob(payload);
            return true;
        }
        catch (error) {
            console.error('Queue Notification Failed:', error);
            return false;
        }
    },
    broadcastToStore: async (storeId, title, message, type = 'INFO') => {
        const users = await User.find({ storeId, isActive: true });
        const promises = users.map((user) => notificationService.send({
            recipientId: user._id.toString(),
            storeId,
            title,
            message,
            type,
        }));
        await Promise.all(promises);
    },
};
