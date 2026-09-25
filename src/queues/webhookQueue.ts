import { Queue } from 'bullmq';

const WEBHOOK_QUEUE_NAME = 'webhook-queue';

export const webhookQueue =
    process.env.SKIP_REDIS === 'true'
        ? null
        : new Queue(WEBHOOK_QUEUE_NAME, {
              connection: {
                  host: process.env.REDIS_HOST || 'localhost',
                  port: parseInt(process.env.REDIS_PORT || '6379'),
              },
          });

interface WebhookJobData {
    webhookId: string;
    event: string;
    payload: any;
}

// attempt: 1-5 with exponential backoff gives a delivery attempt roughly
// immediately, then ~2s/4s/8s/16s later — enough to ride out a receiving
// server's brief restart or deploy without giving up on the first blip,
// which is what the old dispatch()-only path did (hardcoded attempt: 1).
export const addWebhookJob = async (data: WebhookJobData) => {
    if (!webhookQueue) {
        return null;
    }
    return await webhookQueue.add('dispatch-webhook', data, {
        attempts: 5,
        backoff: {
            type: 'exponential',
            delay: 2000,
        },
        removeOnComplete: true,
        removeOnFail: 100,
    });
};
