import dayjs from 'dayjs';
import Store from '../models/Store.js';
import { notificationService } from '../services/notificationService.js';

// Billing was entirely manual — a store owner had to remember to come back
// and re-checkout every cycle, with nothing happening automatically once a
// paid plan's period lapsed.
//
// This doesn't create a speculative invoice for the new period: the billing
// page (and subscriptionController.checkout) only ever supports "start a
// fresh checkout for a plan", not "pay this specific pre-existing invoice" —
// an invoice created here would have no way to actually be paid and would
// just sit unpaid forever even after the owner renews normally. So instead
// this reminds the owner (pointing at the existing, working checkout flow),
// and — the part that was genuinely missing — actually restricts access via
// the same 'Past Due' status checkTrialExpiry already enforces everywhere,
// once the grace period after the renewal date passes.
const GRACE_DAYS_BEFORE_PAST_DUE = 3;

function cycleDays(billingCycle: 'monthly' | 'yearly'): number {
    return billingCycle === 'yearly' ? 365 : 30;
}

export const runSubscriptionRenewalCheck = async () => {
    const now = dayjs();

    const stores = await Store.find({
        isActive: true,
        subscriptionStatus: 'Active',
        subscriptionPlan: { $exists: true, $ne: null },
        lastBillingDate: { $exists: true, $ne: null },
    }).populate('subscriptionPlan');

    for (const store of stores) {
        try {
            const plan = store.subscriptionPlan as any;
            if (!plan || !plan.price || plan.price <= 0) continue; // free plan — nothing to renew

            const renewalDue = dayjs(store.lastBillingDate).add(cycleDays(plan.billingCycle), 'day');
            if (now.isBefore(renewalDue)) continue;

            const daysPastDue = now.diff(renewalDue, 'day');

            if (daysPastDue >= GRACE_DAYS_BEFORE_PAST_DUE) {
                store.subscriptionStatus = 'Past Due';
                await store.save();

                await notificationService.send({
                    recipientId: store.owner.toString(),
                    storeId: (store._id as any).toString(),
                    title: 'Subscription past due — access restricted',
                    message: `Your "${plan.name}" plan for "${store.name}" is ${daysPastDue} day(s) overdue for renewal. Store access is restricted until you renew.`,
                    type: 'ERROR',
                    actionUrl: '/billing',
                });
            } else {
                // One reminder per renewal cycle — renewalReminderSentAt only
                // resets forward when a payment actually lands (lastBillingDate
                // moves), so this can't re-notify daily for the same cycle.
                const alreadyReminded =
                    store.renewalReminderSentAt &&
                    dayjs(store.renewalReminderSentAt).isAfter(dayjs(store.lastBillingDate));
                if (alreadyReminded) continue;

                await notificationService.send({
                    recipientId: store.owner.toString(),
                    storeId: (store._id as any).toString(),
                    title: 'Your subscription renewal is due',
                    message: `Your "${plan.name}" plan for "${store.name}" is due for renewal — ₹${plan.price}. Renew from the Billing page to avoid any interruption.`,
                    type: 'WARNING',
                    actionUrl: '/billing',
                });
                store.renewalReminderSentAt = new Date();
                await store.save();
            }
        } catch (error) {
            console.error(`Subscription renewal check failed for store ${store.name}:`, error);
        }
    }
};
