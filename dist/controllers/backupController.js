import ApiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import mongoose from 'mongoose';
import dayjs from 'dayjs';
import BackupJob from '../models/BackupJob.js';
import RestoreJob from '../models/RestoreJob.js';
import fs from 'fs/promises';
import path from 'path';
import { runBackupForStore } from '../services/backupService.js';
import { downloadBackupFromS3, parseS3Key } from '../config/s3.js';
export const backupController = {
    // @desc    Export store data as direct download
    // @route   GET /api/backup/export
    exportData: asyncHandler(async (req, res) => {
        const collections = ['Product', 'Order', 'Customer', 'Supplier', 'Inventory', 'Brand', 'Category'];
        const backupData = {};
        for (const col of collections) {
            try {
                const Model = mongoose.model(col);
                backupData[col] = await Model.find({ storeId: req.tenantId }).lean();
            }
            catch (err) {
                console.error(`Failed to export collection ${col}:`, err);
            }
        }
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=backup_${req.tenantId}_${Date.now()}.json`);
        res.status(200).send(JSON.stringify(backupData, null, 2));
    }),
    // @desc    Trigger a manual backup job
    // @route   POST /api/backup/trigger
    triggerBackup: asyncHandler(async (req, res) => {
        const userId = req.user?._id;
        if (!userId) {
            return res.status(401).json(new ApiResponse(401, null, 'User not authenticated'));
        }
        // Shares the same S3-vs-local storage logic as the daily cron backup,
        // instead of a separate local-only copy of it.
        const backupJob = await runBackupForStore(req.tenantId, userId, 'backup');
        if (backupJob.status === 'Failed') {
            return res.status(500).json(new ApiResponse(500, null, 'Backup failed: ' + backupJob.error));
        }
        res.status(200).json(new ApiResponse(200, backupJob, 'Backup completed successfully'));
    }),
    // @desc    Get backup history. A Super Admin has no store context (no x-store-id
    //          header, req.tenantId is undefined) and sees the platform-wide registry
    //          across every tenant; a store owner stays scoped to their own store.
    // @route   GET /api/backup/history
    getBackupHistory: asyncHandler(async (req, res) => {
        const { status = '', startDate = '', endDate = '' } = req.query;
        const isPlatformWide = req.user?.role === 'SUPER_ADMIN' && !req.tenantId;
        const query = isPlatformWide ? {} : { storeId: req.tenantId };
        if (status)
            query.status = status;
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate)
                query.createdAt.$gte = dayjs(startDate)
                    .startOf('day')
                    .toDate();
            if (endDate)
                query.createdAt.$lte = dayjs(endDate)
                    .endOf('day')
                    .toDate();
        }
        let historyQuery = BackupJob.find(query)
            .sort({ createdAt: -1 })
            .populate('triggeredBy', 'name email')
            .limit(20);
        if (isPlatformWide)
            historyQuery = historyQuery.populate('storeId', 'name');
        const history = await historyQuery;
        res.status(200).json(new ApiResponse(200, history, 'Backup history retrieved'));
    }),
    // @desc    Restore from a backup
    // @route   POST /api/backup/restore/:id
    restoreBackup: asyncHandler(async (req, res) => {
        const { id } = req.params;
        const userId = req.user?._id;
        const backup = await BackupJob.findOne({ _id: id, storeId: req.tenantId });
        if (!backup || !backup.fileUrl) {
            return res.status(404).json(new ApiResponse(404, null, 'Backup file not found'));
        }
        const restoreJob = await RestoreJob.create({
            backupJobId: backup._id,
            storeId: req.tenantId,
            status: 'Running',
            restoredBy: userId,
        });
        try {
            // Restore previously only ever worked for local-disk backups — a
            // backup actually written to S3 (fileUrl looks like "s3://bucket/key",
            // not a filesystem path) would fail here with ENOENT every time.
            const content = backup.storageLocation === 's3'
                ? await downloadBackupFromS3(parseS3Key(backup.fileUrl))
                : await fs.readFile(path.join(process.cwd(), backup.fileUrl), 'utf-8');
            const data = JSON.parse(content);
            // Dynamic restoration
            for (const [colName, docs] of Object.entries(data)) {
                if (!Array.isArray(docs))
                    continue;
                const Model = mongoose.model(colName);
                // For this SaaS, we delete existing and re-insert to ensure clean state for that backup
                // WARNING: In production, you might want to merge or use a more careful approach
                await Model.deleteMany({ storeId: req.tenantId });
                if (docs.length > 0) {
                    await Model.insertMany(docs);
                }
            }
            restoreJob.status = 'Completed';
            await restoreJob.save();
            res.status(200).json(new ApiResponse(200, restoreJob, 'Data restored successfully'));
        }
        catch (error) {
            restoreJob.status = 'Failed';
            restoreJob.error = error.message;
            await restoreJob.save();
            res.status(500).json(new ApiResponse(500, null, 'Restore failed: ' + error.message));
        }
    }),
};
