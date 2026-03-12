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
import { archiveService } from './services/archiveService.js';

import { initNotificationWorker } from './workers/notificationWorker.js';

export const initArchiveCronJob = () => {
    // Run weekly on Sunday at 3 AM
    cron.schedule('0 3 * * 0', async () => {
        console.log('Running weekly data cleanup and archiving...');
        try {
            const stores = await Store.find({ isActive: true });
            for (const store of stores) {
                await archiveService.cleanupNotifications(store._id as any);
                await archiveService.archiveLogs(store._id as any);
            }
        } catch (error) {
            console.error('Archive cron failed:', error);
        }
    });
};

// Initialize Workers
initNotificationWorker();
initBackupCron();
initArchiveCronJob();

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

        httpServer.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();
