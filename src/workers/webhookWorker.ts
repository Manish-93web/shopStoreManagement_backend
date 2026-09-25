import { Worker } from 'bullmq';
import Webhook from '../models/Webhook.js';
import webhookService from '../services/webhookService.js';

export const initWebhookWorker = () => {
    if (process.env.SKIP_REDIS === 'true') return;

    const worker = new Worker(
        'webhook-queue',
        async (job) => {
            const { webhookId, event, payload } = job.data;
            const webhook = await Webhook.findById(webhookId);
            // Deleted or disabled since this job was queued — nothing to deliver to.
            if (!webhook || !webhook.isActive) return;

            console.log(`[Worker] Dispatching webhook job ${job.id} (attempt ${job.attemptsMade + 1})...`);
            await webhookService.dispatch(webhook, event, payload, job.attemptsMade + 1);
        },
        {
            connection: {
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '6379'),
            },
        }
    );

    worker.on('completed', (job) => {
        console.log(`[Worker] Webhook job ${job.id} delivered.`);
    });

    worker.on('failed', (job, err) => {
        console.error(`[Worker] Webhook job ${job?.id} failed: ${err.message}`);
    });
};
