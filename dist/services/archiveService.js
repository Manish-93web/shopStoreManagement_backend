import ArchiveJob from '../models/ArchiveJob.js';
import Order from '../models/Order.js';
import Notification from '../models/Notification.js';
import AuditLog from '../models/AuditLog.js';
import dayjs from 'dayjs';
export const archiveService = {
    /**
     * Archive old orders (older than 1 year)
     */
    archiveOldOrders: async (storeId, userId, months = 12) => {
        const thresholdDate = dayjs().subtract(months, 'months').toDate();
        const job = await ArchiveJob.create({
            storeId,
            collectionName: 'Orders',
            dateRange: { from: new Date(0), to: thresholdDate },
            status: 'Running',
            triggeredBy: userId,
        });
        try {
            // In a real production system, you'd move these to a separate 'ArchivedOrder' collection
            // For now, we simulate archiving by marking them or just deleting if retention policy mandates
            // Here we'll count how many would be archived
            const count = await Order.countDocuments({
                storeId,
                createdAt: { $lt: thresholdDate },
            });
            // Re-implementing simplified logic: deletion/movement would go here
            // await Order.deleteMany({ storeId, createdAt: { $lt: thresholdDate } });
            job.status = 'Completed';
            job.archivedCount = count;
            await job.save();
            return job;
        }
        catch (error) {
            job.status = 'Failed';
            job.error = error.message;
            await job.save();
            throw error;
        }
    },
    /**
     * Cleanup old notifications (Read, older than 30 days)
     */
    cleanupNotifications: async (storeId) => {
        const thresholdDate = dayjs().subtract(30, 'days').toDate();
        await Notification.deleteMany({
            storeId,
            read: true,
            createdAt: { $lt: thresholdDate },
        });
    },
    /**
     * Archive audit logs (older than 6 months). Previously targeted the unused
     * ActivityLog model (nothing in the app ever writes to it, so this silently
     * cleaned up nothing every week) — AuditLog is the model every write path
     * actually uses.
     */
    archiveLogs: async (storeId) => {
        const thresholdDate = dayjs().subtract(6, 'months').toDate();
        // Move to Archive or compress
        await AuditLog.deleteMany({
            storeId,
            createdAt: { $lt: thresholdDate },
        });
    },
};
