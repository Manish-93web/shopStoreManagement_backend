import crypto from 'crypto';
import dayjs from 'dayjs';
import ApiKey from '../models/ApiKey.js';
import ApiRequestLog from '../models/ApiRequestLog.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/apiResponse.js';
// @desc    Get all API keys for tenant
// @route   GET /api/api-keys
export const getApiKeys = asyncHandler(async (req, res) => {
    const apiKeys = await ApiKey.find({ tenantId: req.tenantId }).sort('-createdAt');
    res.status(200).json(new ApiResponse(200, apiKeys));
});
// @desc    Create new API key
// @route   POST /api/api-keys
export const createApiKey = asyncHandler(async (req, res) => {
    const { name, permissions } = req.body;
    // Generate a secure random key
    const rawKey = crypto.randomBytes(32).toString('hex');
    const prefix = rawKey.substring(0, 8);
    // Hash the key for storage
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const apiKey = await ApiKey.create({
        name,
        keyHash,
        prefix,
        permissions: permissions || ['read:all'],
        tenantId: req.tenantId,
        isActive: true
    });
    // We only return the rawKey this ONE time
    res.status(201).json(new ApiResponse(201, {
        apiKey,
        rawKey // Frontend must display this to the user immediately
    }, "API Key generated successfully"));
});
// @desc    Update API key (e.g., deactivate)
// @route   PUT /api/api-keys/:id
export const updateApiKey = asyncHandler(async (req, res) => {
    // Only allow updating name and active status
    const { name, isActive, permissions } = req.body;
    const apiKey = await ApiKey.findOneAndUpdate({ _id: req.params.id, tenantId: req.tenantId }, { name, isActive, permissions }, { returnDocument: 'after' });
    if (!apiKey)
        return res.status(404).json(new ApiResponse(404, null, "API Key not found"));
    res.status(200).json(new ApiResponse(200, apiKey, "API Key updated successfully"));
});
// @desc    Delete API key
// @route   DELETE /api/api-keys/:id
export const deleteApiKey = asyncHandler(async (req, res) => {
    const apiKey = await ApiKey.findOneAndDelete({ _id: req.params.id, tenantId: req.tenantId });
    if (!apiKey)
        return res.status(404).json(new ApiResponse(404, null, "API Key not found"));
    await ApiRequestLog.deleteMany({ apiKeyId: apiKey._id });
    res.status(200).json(new ApiResponse(200, null, "API Key deleted successfully"));
});
// @desc    Usage analytics for one API key — daily request counts over the
//          last 14 days plus the most recent calls, previously there was no
//          way to see request volume at all, only a single lastUsedAt timestamp.
// @route   GET /api/api-keys/:id/usage
export const getApiKeyUsage = asyncHandler(async (req, res) => {
    const apiKey = await ApiKey.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!apiKey)
        return res.status(404).json(new ApiResponse(404, null, "API Key not found"));
    const since = dayjs().subtract(14, 'days').startOf('day').toDate();
    const [dailyCounts, recent] = await Promise.all([
        ApiRequestLog.aggregate([
            { $match: { apiKeyId: apiKey._id, createdAt: { $gte: since } } },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    count: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
        ]),
        ApiRequestLog.find({ apiKeyId: apiKey._id }).sort({ createdAt: -1 }).limit(20),
    ]);
    res.status(200).json(new ApiResponse(200, {
        totalRequests: apiKey.usageCount || 0,
        lastUsedAt: apiKey.lastUsedAt,
        dailyCounts: dailyCounts.map((d) => ({ date: d._id, count: d.count })),
        recent,
    }));
});
