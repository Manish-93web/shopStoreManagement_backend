import { Response } from 'express';
import { TenantRequest } from '../middleware/tenantHandler.js';
import ApiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import dayjs from 'dayjs';
import ArchiveJob from '../models/ArchiveJob.js';
import Settings from '../models/Settings.js';
import { archiveService } from '../services/archiveService.js';

export const archiveController = {
    // @desc    Get archive history. Same platform-wide-vs-tenant-scoped split as
    //          backupController.getBackupHistory: a Super Admin (no req.tenantId) sees
    //          every store's jobs, a store owner stays scoped to their own.
    // @route   GET /api/archive/jobs
    getJobs: asyncHandler(async (req: TenantRequest, res: Response) => {
        const { status = '', startDate = '', endDate = '' } = req.query;
        const isPlatformWide = req.user?.role === 'SUPER_ADMIN' && !req.tenantId;

        const query: Record<string, any> = isPlatformWide ? {} : { storeId: req.tenantId };
        if (status) query.status = status as string;
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate)
                query.createdAt.$gte = dayjs(startDate as string)
                    .startOf('day')
                    .toDate();
            if (endDate)
                query.createdAt.$lte = dayjs(endDate as string)
                    .endOf('day')
                    .toDate();
        }

        let jobsQuery = ArchiveJob.find(query).sort({ createdAt: -1 }).populate('triggeredBy', 'name email').limit(20);
        if (isPlatformWide) jobsQuery = jobsQuery.populate('storeId', 'name');

        const jobs = await jobsQuery;
        res.status(200).json(new ApiResponse(200, jobs, 'Archive history retrieved'));
    }),

    // @desc    Trigger a manual archive
    // @route   POST /api/archive/run
    runArchive: asyncHandler(async (req: TenantRequest, res: Response) => {
        const { collection, months } = req.body;
        const userId = req.user?._id;

        if (!userId) return res.status(401).json(new ApiResponse(401, null, 'Unauthorized'));

        let job;
        if (collection === 'Orders') {
            job = await archiveService.archiveOldOrders(req.tenantId as any, userId as any, months || 12);
        } else {
            return res.status(400).json(new ApiResponse(400, null, 'Unsupported collection for archiving'));
        }

        res.status(200).json(new ApiResponse(200, job, 'Archive job completed'));
    }),

    // @desc    Restore every order from a completed archive job back into the
    //          live collection
    // @route   POST /api/archive/:jobId/restore
    restoreArchive: asyncHandler(async (req: TenantRequest, res: Response) => {
        try {
            const result = await archiveService.restoreArchivedOrders(req.params.jobId as string);
            res.status(200).json(new ApiResponse(200, result, `Restored ${result.restoredCount} order(s)`));
        } catch (error: any) {
            res.status(400).json(new ApiResponse(400, null, error.message));
        }
    }),

    // @desc    Get this store's archive retention policy — what the weekly
    //          background job uses when it runs unattended, distinct from the
    //          one-off "Run Archive Now" scan which always takes an explicit
    //          months value from the request instead.
    // @route   GET /api/archive/policy
    getPolicy: asyncHandler(async (req: TenantRequest, res: Response) => {
        if (!req.tenantId) return res.status(400).json(new ApiResponse(400, null, 'Select a store first'));
        const settings = await Settings.findOne({ storeId: req.tenantId });
        res.status(200).json(
            new ApiResponse(
                200,
                settings?.archiveConfig || {
                    autoArchiveEnabled: false,
                    orderRetentionMonths: 24,
                    notificationRetentionDays: 30,
                    auditLogRetentionMonths: 6,
                }
            )
        );
    }),

    // @desc    Update this store's archive retention policy
    // @route   PUT /api/archive/policy
    updatePolicy: asyncHandler(async (req: TenantRequest, res: Response) => {
        if (!req.tenantId) return res.status(400).json(new ApiResponse(400, null, 'Select a store first'));
        const { autoArchiveEnabled, orderRetentionMonths, notificationRetentionDays, auditLogRetentionMonths } =
            req.body;

        const settings = await Settings.findOneAndUpdate(
            { storeId: req.tenantId },
            {
                $set: {
                    'archiveConfig.autoArchiveEnabled': !!autoArchiveEnabled,
                    'archiveConfig.orderRetentionMonths': Math.max(1, Number(orderRetentionMonths) || 24),
                    'archiveConfig.notificationRetentionDays': Math.max(1, Number(notificationRetentionDays) || 30),
                    'archiveConfig.auditLogRetentionMonths': Math.max(1, Number(auditLogRetentionMonths) || 6),
                },
            },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        res.status(200).json(new ApiResponse(200, settings.archiveConfig, 'Archive policy updated'));
    }),
};
