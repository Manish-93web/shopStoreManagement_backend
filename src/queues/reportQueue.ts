import { Queue } from 'bullmq';
import { createClient } from 'redis';

const connection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379')
};

export const reportQueue = new Queue('report-generation', { connection });

export const addReportJob = async (data: { tenantId: string, type: string, filters: any }) => {
    await reportQueue.add('generate-report', data);
};
