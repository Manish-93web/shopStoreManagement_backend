import { Response } from 'express';
import { TenantRequest } from '../middleware/tenantHandler.js';
import ApiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import ArchiveJob from '../models/ArchiveJob.js';
import { archiveService } from '../services/archiveService.js';

export const archiveController = {
    // @desc    Get archive history
    // @route   GET /api/archive/jobs
    getJobs: asyncHandler(async (req: TenantRequest, res: Response) => {
        const jobs = await ArchiveJob.find({ storeId: req.tenantId })
            .sort({ createdAt: -1 })
            .populate('triggeredBy', 'name email')
            .limit(20);
        res.status(200).json(new ApiResponse(200, jobs, "Archive history retrieved"));
    }),

    // @desc    Trigger a manual archive
    // @route   POST /api/archive/run
    runArchive: asyncHandler(async (req: TenantRequest, res: Response) => {
        const { collection, months } = req.body;
        const userId = req.user?._id;

        if (!userId) return res.status(401).json(new ApiResponse(401, null, "Unauthorized"));

        let job;
        if (collection === 'Orders') {
            job = await archiveService.archiveOldOrders(req.tenantId as any, userId as any, months || 12);
        } else {
            return res.status(400).json(new ApiResponse(400, null, "Unsupported collection for archiving"));
        }

        res.status(200).json(new ApiResponse(200, job, "Archive job completed"));
    })
};
