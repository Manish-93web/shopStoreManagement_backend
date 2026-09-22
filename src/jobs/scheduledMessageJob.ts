import ScheduledMessage from '../models/ScheduledMessage.js';
import Store from '../models/Store.js';
import Customer from '../models/Customer.js';
import { notificationService } from '../services/notificationService.js';

// Checks for scheduled WhatsApp reminders that have come due and notifies the
// store owner it's time to send them. Deliberately does NOT auto-send via the
// WhatsApp API — there's no human present at fire time to catch a message that
// WhatsApp Business API silently rejects for lacking a pre-approved Content
// Template (this codebase has no such support), so every actual send stays a
// human click-through via the existing wa.me flow, just prompted at the right time.
export const runScheduledMessageCheck = async () => {
    const due = await ScheduledMessage.find({ status: 'Pending', scheduledFor: { $lte: new Date() } });

    for (const item of due) {
        try {
            const store = await Store.findById(item.storeId);
            const customer = await Customer.findById(item.customer);
            if (!store) continue;

            await notificationService.send({
                recipientId: store.owner.toString(),
                storeId: item.storeId.toString(),
                title: 'WhatsApp reminder due',
                message: `Time to send "${item.templateLabel}" to ${customer?.name || 'a customer'}.`,
                type: 'INFO',
                metadata: { scheduledMessageId: item._id },
            });

            item.status = 'Due';
            await item.save();
        } catch (error) {
            console.error(`Scheduled message check failed for ${item._id}:`, error);
        }
    }
};
