import mongoose from 'mongoose';
import ArchiveJob from '../models/ArchiveJob.js';
import ArchivedOrder from '../models/ArchivedOrder.js';
import Order from '../models/Order.js';
import Notification from '../models/Notification.js';
import AuditLog from '../models/AuditLog.js';
import dayjs from 'dayjs';

export const archiveService = {
    /**
     * Archive orders older than the given retention window — moves each
     * matching order's full document into ArchivedOrder (cold storage, still
     * restorable) and removes it from the live Order collection. Previously
     * this only counted matching orders and never actually moved or removed
     * anything, so "old databases grow very fast" was never actually
     * addressed despite the job reporting "Completed".
     */
    archiveOldOrders: async (
        storeId: mongoose.Types.ObjectId,
        userId: mongoose.Types.ObjectId,
        months: number = 12
    ) => {
        const thresholdDate = dayjs().subtract(months, 'months').toDate();

        const job = await ArchiveJob.create({
            storeId,
            collectionName: 'Orders',
            dateRange: { from: new Date(0), to: thresholdDate },
            status: 'Running',
            triggeredBy: userId,
        });

        try {
            const matchingOrders = await Order.find({ storeId, createdAt: { $lt: thresholdDate } }).lean();

            if (matchingOrders.length > 0) {
                await ArchivedOrder.insertMany(
                    matchingOrders.map((o) => ({
                        storeId,
                        archiveJobId: job._id,
                        originalId: o._id,
                        data: o,
                        archivedAt: new Date(),
                    }))
                );
                await Order.deleteMany({ _id: { $in: matchingOrders.map((o) => o._id) } });
            }

            job.status = 'Completed';
            job.archivedCount = matchingOrders.length;
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
     * Moves every order from one archive job back into the live Order
     * collection and removes the cold-storage copies — the reverse of
     * archiveOldOrders, for the same job.
     */
    restoreArchivedOrders: async (archiveJobId: mongoose.Types.ObjectId | string) => {
        const job = await ArchiveJob.findById(archiveJobId);
        if (!job) throw new Error('Archive job not found');
        if (job.status !== 'Completed') throw new Error('Only a completed archive job can be restored');
        if (job.restoredAt) throw new Error('This archive job has already been restored');

        const archived = await ArchivedOrder.find({ archiveJobId });
        if (archived.length > 0) {
            await Order.insertMany(archived.map((a) => a.data));
            await ArchivedOrder.deleteMany({ archiveJobId });
        }

        job.restoredAt = new Date();
        await job.save();
        return { restoredCount: archived.length };
    },

    /**
     * Cleanup old notifications (Read, older than the given retention window —
     * defaults to 30 days, matching this job's long-standing behavior before
     * retention became store-configurable via Settings.archiveConfig).
     */
    cleanupNotifications: async (storeId: mongoose.Types.ObjectId, retentionDays: number = 30) => {
        const thresholdDate = dayjs().subtract(retentionDays, 'days').toDate();
        await Notification.deleteMany({
            storeId,
            read: true,
            createdAt: { $lt: thresholdDate },
        });
    },

    /**
     * Archive audit logs older than the given retention window (default 6
     * months). Previously targeted the unused ActivityLog model (nothing in
     * the app ever writes to it, so this silently cleaned up nothing every
     * week) — AuditLog is the model every write path actually uses.
     */
    archiveLogs: async (storeId: mongoose.Types.ObjectId, retentionMonths: number = 6) => {
        const thresholdDate = dayjs().subtract(retentionMonths, 'months').toDate();
        // Move to Archive or compress
        await AuditLog.deleteMany({
            storeId,
            createdAt: { $lt: thresholdDate },
        });
    },
};
