import cron from 'node-cron';
import mongoose from 'mongoose';
import BackupJob from '../models/BackupJob.js';
import Store from '../models/Store.js';
import fs from 'fs/promises';
import path from 'path';
import { isS3Configured, uploadBackupToS3 } from '../config/s3.js';
const BACKUP_COLLECTIONS = ['Product', 'Order', 'Customer', 'Supplier', 'Inventory', 'Brand', 'Category'];
// Shared by both the daily cron and the manual "trigger backup now" endpoint, so
// both paths always get the same real S3-vs-local storage behavior.
export const runBackupForStore = async (storeId, triggeredBy, filePrefix = 'auto_backup') => {
    const backupJob = await BackupJob.create({
        storeId,
        type: 'Full',
        status: 'Running',
        triggeredBy,
    });
    try {
        const backupData = {};
        for (const col of BACKUP_COLLECTIONS) {
            const Model = mongoose.model(col);
            backupData[col] = await Model.find({ storeId }).lean();
        }
        const fileName = `${filePrefix}_${storeId}_${Date.now()}.json`;
        const content = JSON.stringify(backupData, null, 2);
        const contentBuffer = Buffer.from(content);
        // Real off-server storage when AWS credentials are configured — a
        // server loss previously also lost every backup, since this only
        // ever wrote to local disk on the same machine. Honest fallback to
        // local disk (today's existing behavior) when S3 isn't configured.
        if (isS3Configured()) {
            const key = `backups/${storeId}/${fileName}`;
            const location = await uploadBackupToS3(key, contentBuffer, 'application/json');
            backupJob.fileUrl = location;
            backupJob.storageLocation = 's3';
        }
        else {
            const backupDir = path.join(process.cwd(), 'uploads', 'backups');
            await fs.mkdir(backupDir, { recursive: true });
            const filePath = path.join(backupDir, fileName);
            await fs.writeFile(filePath, content);
            backupJob.fileUrl = `/uploads/backups/${fileName}`;
            backupJob.storageLocation = 'local';
        }
        backupJob.status = 'Completed';
        backupJob.fileSize = contentBuffer.byteLength;
        await backupJob.save();
    }
    catch (err) {
        backupJob.status = 'Failed';
        backupJob.error = err.message;
        await backupJob.save();
    }
    return backupJob;
};
export const initBackupCron = () => {
    // Run at 2 AM daily
    cron.schedule('0 2 * * *', async () => {
        console.log('Starting automated daily backup...');
        try {
            const stores = await Store.find({ isActive: true });
            for (const store of stores) {
                console.log(`Backing up store: ${store.name} (${store._id})`);
                // System triggered, use owner as proxy or a system user ID
                await runBackupForStore(store._id, store.owner, 'auto_backup');
            }
            console.log('Automated daily backup completed.');
        }
        catch (error) {
            console.error('Critical error in automated backup cron:', error);
        }
    });
};
