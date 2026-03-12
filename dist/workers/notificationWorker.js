import { Worker } from 'bullmq';
import { notificationService } from '../services/notificationService.js';
export const initNotificationWorker = () => {
    if (process.env.SKIP_REDIS === 'true')
        return;
    const worker = new Worker('notification-queue', async (job) => {
        console.log(`[Worker] Processing notification job ${job.id}...`);
        try {
            await notificationService.send(job.data);
        }
        catch (error) {
            console.error(`[Worker] Job ${job.id} failed:`, error);
            throw error;
        }
    }, {
        connection: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379')
        }
    });
    worker.on('completed', (job) => {
        console.log(`[Worker] Notification job ${job.id} completed.`);
    });
    worker.on('failed', (job, err) => {
        console.error(`[Worker] Notification job ${job?.id} failed: ${err.message}`);
    });
};
