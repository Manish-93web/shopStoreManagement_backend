import './config/env.js';
import app from './app.js';
import { initSentry } from './config/sentry.js';
import connectDB from './config/db.js';
import { createServer } from 'http';
import { initSocket } from './config/socket.js';
import { connectRedis } from './config/redis.js';
import './workers/reportWorker.js';
import { initBackupCron } from './services/backupService.js';
import cron from 'node-cron';
import Store from './models/Store.js';
import Settings from './models/Settings.js';
import { archiveService } from './services/archiveService.js';
import { initReportScheduler } from './utils/scheduler.js';
import { runDailyInventoryChecks } from './jobs/inventoryCheckJob.js';
import { runScheduledMessageCheck } from './jobs/scheduledMessageJob.js';
import { runSubscriptionExpiryCheck } from './jobs/subscriptionExpiryJob.js';
import { runSubscriptionRenewalCheck } from './jobs/subscriptionRenewalJob.js';
import { initNotificationWorker } from './workers/notificationWorker.js';
import { initWebhookWorker } from './workers/webhookWorker.js';
export const initArchiveCronJob = () => {
    // Run weekly on Sunday at 3 AM
    cron.schedule('0 3 * * 0', async () => {
        console.log('Running weekly data cleanup and archiving...');
        try {
            const stores = await Store.find({ isActive: true });
            for (const store of stores) {
                const storeId = store._id;
                const settings = await Settings.findOne({ storeId });
                const policy = settings?.archiveConfig;
                await archiveService.cleanupNotifications(storeId, policy?.notificationRetentionDays);
                await archiveService.archiveLogs(storeId, policy?.auditLogRetentionMonths);
                // Automatic order archiving was previously never scheduled at all —
                // "Run Archive Now" was the only way old orders ever got archived,
                // no matter how the retention slider was set. Opt-in per store via
                // Settings.archiveConfig.autoArchiveEnabled (defaults to off, so no
                // store's order history starts disappearing without an explicit choice).
                if (policy?.autoArchiveEnabled) {
                    try {
                        await archiveService.archiveOldOrders(storeId, store.owner, policy.orderRetentionMonths);
                    }
                    catch (error) {
                        console.error(`Auto order-archive failed for store ${store.name}:`, error);
                    }
                }
            }
        }
        catch (error) {
            console.error('Archive cron failed:', error);
        }
    });
};
// runDailyInventoryChecks (low-stock + expiring-batch alerts) was fully implemented
// but never registered anywhere — same class of dead-scheduler bug already found and
// fixed for the report scheduler above.
export const initInventoryCheckCron = () => {
    // Run daily at 1 AM
    cron.schedule('0 1 * * *', async () => {
        try {
            await runDailyInventoryChecks();
        }
        catch (error) {
            console.error('Inventory check cron failed:', error);
        }
    });
};
export const initScheduledMessageCron = () => {
    // Check every minute for due WhatsApp reminders
    cron.schedule('* * * * *', async () => {
        try {
            await runScheduledMessageCheck();
        }
        catch (error) {
            console.error('Scheduled message cron failed:', error);
        }
    });
};
export const initSubscriptionExpiryCron = () => {
    // Run daily at 9 AM — a warning about billing shouldn't arrive at 1 AM.
    cron.schedule('0 9 * * *', async () => {
        try {
            await runSubscriptionExpiryCheck();
        }
        catch (error) {
            console.error('Subscription expiry cron failed:', error);
        }
    });
};
export const initSubscriptionRenewalCron = () => {
    // Run daily at 9 AM, alongside the trial-expiry check.
    cron.schedule('0 9 * * *', async () => {
        try {
            await runSubscriptionRenewalCheck();
        }
        catch (error) {
            console.error('Subscription renewal cron failed:', error);
        }
    });
};
// Initialize Workers
initNotificationWorker();
initWebhookWorker();
initBackupCron();
initArchiveCronJob();
initReportScheduler();
initInventoryCheckCron();
initScheduledMessageCron();
initSubscriptionExpiryCron();
initSubscriptionRenewalCron();
const PORT = process.env.PORT || 5000;
const httpServer = createServer(app);
// Initialize Sentry
initSentry();
// Initialize Socket.io
initSocket(httpServer);
const startServer = async () => {
    try {
        await connectDB();
        await connectRedis();
        httpServer.listen(PORT, '0.0.0.0', () => {
            console.log(`Server is running on port ${PORT} (0.0.0.0)`);
        });
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};
startServer();
