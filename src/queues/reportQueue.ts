import { Queue } from 'bullmq';
import { createClient } from 'redis';

const connection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379')
};

let reportQueue: Queue | null = null;

if (process.env.SKIP_REDIS !== 'true') {
    reportQueue = new Queue('report-generation', { connection });
}

export const addReportJob = async (data: { tenantId: string, type: string, filters: any }) => {
    if (process.env.SKIP_REDIS === 'true') {
        console.log('Skipping report job addition (SKIP_REDIS=true):', data.type);
        return;
    }
    await reportQueue?.add('generate-report', data);
};

export { reportQueue };
