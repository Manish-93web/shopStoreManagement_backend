import dayjs from 'dayjs';
import Store from '../models/Store.js';
import { notificationService } from '../services/notificationService.js';

// checkTrialExpiry (usageLimits.ts) only ever blocks access AFTER a trial has
// already lapsed — there was no proactive warning beforehand, so an owner's
// first sign that anything was wrong was the app suddenly refusing requests.
// This sends two advance warnings (3 days out, 1 day out) to the store owner.
export const runSubscriptionExpiryCheck = async () => {
    const now = dayjs();
    const stores = await Store.find({
        isActive: true,
        subscriptionStatus: 'Trialing',
        trialEndsAt: { $exists: true, $ne: null },
    });

    for (const store of stores) {
        try {
            const daysLeft = dayjs(store.trialEndsAt).diff(now, 'day');

            if (daysLeft <= 3 && daysLeft > 1 && !store.trialWarned3Day) {
                await notificationService.send({
                    recipientId: store.owner.toString(),
                    storeId: (store._id as any).toString(),
                    title: 'Your trial ends soon',
                    message: `Your Store360 trial for "${store.name}" ends in ${daysLeft} day(s). Upgrade to a paid plan to avoid any interruption.`,
                    type: 'WARNING',
                    actionUrl: '/billing',
                });
                store.trialWarned3Day = true;
                await store.save();
            } else if (daysLeft <= 1 && !store.trialWarned1Day) {
                await notificationService.send({
                    recipientId: store.owner.toString(),
                    storeId: (store._id as any).toString(),
                    title: daysLeft <= 0 ? 'Your trial ends today' : 'Your trial ends tomorrow',
                    message: `Your Store360 trial for "${store.name}" ${daysLeft <= 0 ? 'ends today' : 'ends tomorrow'}. Upgrade now to keep using your store without interruption.`,
                    type: 'ERROR',
                    actionUrl: '/billing',
                });
                store.trialWarned1Day = true;
                await store.save();
            }
        } catch (error) {
            console.error(`Subscription expiry check failed for store ${store.name}:`, error);
        }
    }
};
