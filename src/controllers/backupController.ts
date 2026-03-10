import { Response } from 'express';
import { TenantRequest } from '../middleware/tenantHandler.js';
import ApiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import mongoose from 'mongoose';

export const backupController = {
    // @desc    Export store data
    // @route   GET /api/backup/export
    exportData: asyncHandler(async (req: TenantRequest, res: Response) => {
        const collections = ['Product', 'Order', 'Customer', 'Supplier', 'Inventory'];
        const backupData: any = {};

        for (const col of collections) {
            const Model = mongoose.model(col);
            backupData[col] = await Model.find({ storeId: req.tenantId });
        }

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=backup_${req.tenantId}_${Date.now()}.json`);
        res.status(200).send(JSON.stringify(backupData, null, 2));
    }),

    // @desc    Get backup history (placeholder)
    getBackupHistory: asyncHandler(async (req: TenantRequest, res: Response) => {
        // In a real app, track backups in a BackupLog model
        res.status(200).json(new ApiResponse(200, [], "No recent automated backups found."));
    })
};
