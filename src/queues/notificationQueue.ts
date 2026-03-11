import { Queue } from 'bullmq';
import redisClient from '../config/redis.js';

const NOTIFICATION_QUEUE_NAME = 'notification-queue';

export const notificationQueue = process.env.SKIP_REDIS === 'true'
    ? null
    : new Queue(NOTIFICATION_QUEUE_NAME, {
        connection: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379')
        }
    });

export const addNotificationJob = async (data: any) => {
    if (!notificationQueue) {
        console.log('[Queue Disabled] Processing notification immediately via service fallback...');
        return null;
    }
    return await notificationQueue.add('send-notification', data, {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000,
        },
        removeOnComplete: true
    });
};
