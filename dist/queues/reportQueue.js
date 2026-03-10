import { Queue } from 'bullmq';
const connection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379')
};
export const reportQueue = new Queue('report-generation', { connection });
export const addReportJob = async (data) => {
    await reportQueue.add('generate-report', data);
};
