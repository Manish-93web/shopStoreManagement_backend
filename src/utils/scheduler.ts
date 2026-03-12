import cron from 'node-cron';
import { addReportJob } from '../queues/reportQueue.js';
import Store from '../models/Store.js';
import User from '../models/User.js';

// Simple scheduler to run daily reports for all stores
export const initReportScheduler = () => {
    // Run at 00:00 every day
    cron.schedule('0 0 * * *', async () => {
        console.log('Running daily scheduled reports...');

        try {
            const stores = await Store.find({ isActive: true });

            for (const store of stores) {
                // Find owner of the store
                const owner = await User.findOne({ storeId: store._id, role: 'Owner' });

                if (owner) {
                    await addReportJob({
                        tenantId: store._id.toString(),
                        type: 'sales',
                        filters: {
                            startDate: new Date(new Date().setDate(new Date().getDate() - 1)).toISOString(),
                            endDate: new Date().toISOString()
                        },
                        userId: owner._id.toString()
                    } as any);
                }
            }
        } catch (error) {
            console.error('Scheduled report task failed:', error);
        }
    });
};
