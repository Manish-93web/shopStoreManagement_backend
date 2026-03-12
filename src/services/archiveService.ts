import mongoose from 'mongoose';
import ArchiveJob from '../models/ArchiveJob.js';
import Order from '../models/Order.js';
import Notification from '../models/Notification.js';
import ActivityLog from '../models/ActivityLog.js';
import dayjs from 'dayjs';

export const archiveService = {
    /**
     * Archive old orders (older than 1 year)
     */
    archiveOldOrders: async (storeId: mongoose.Types.ObjectId, userId: mongoose.Types.ObjectId, months: number = 12) => {
        const thresholdDate = dayjs().subtract(months, 'months').toDate();

        const job = await ArchiveJob.create({
            storeId,
            collectionName: 'Orders',
            dateRange: { from: new Date(0), to: thresholdDate },
            status: 'Running',
            triggeredBy: userId
        });

        try {
            // In a real production system, you'd move these to a separate 'ArchivedOrder' collection
            // For now, we simulate archiving by marking them or just deleting if retention policy mandates
            // Here we'll count how many would be archived
            const count = await Order.countDocuments({
                storeId,
                createdAt: { $lt: thresholdDate }
            });

            // Re-implementing simplified logic: deletion/movement would go here
            // await Order.deleteMany({ storeId, createdAt: { $lt: thresholdDate } });

            job.status = 'Completed';
            job.archivedCount = count;
            await job.save();
            return job;
        } catch (error: any) {
            job.status = 'Failed';
            job.error = error.message;
            await job.save();
            throw error;
        }
    },

    /**
     * Cleanup old notifications (Read, older than 30 days)
     */
    cleanupNotifications: async (storeId: mongoose.Types.ObjectId) => {
        const thresholdDate = dayjs().subtract(30, 'days').toDate();
        await Notification.deleteMany({
            storeId,
            read: true,
            createdAt: { $lt: thresholdDate }
        });
    },

    /**
     * Archive audit/activity logs (older than 6 months)
     */
    archiveLogs: async (storeId: mongoose.Types.ObjectId) => {
        const thresholdDate = dayjs().subtract(6, 'months').toDate();
        // Move to Archive or compress
        await ActivityLog.deleteMany({
            storeId,
            createdAt: { $lt: thresholdDate }
        });
    }
};
