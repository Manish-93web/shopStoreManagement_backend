import { Response } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/apiResponse.js';
import { TenantRequest } from '../middleware/tenantHandler.js';
import { getCloudinaryClient, isCloudinaryConfigured } from '../config/cloudinary.js';

// @desc    Upload an image — uses real Cloudinary storage when configured, and
//          honestly falls back to an inline base64 data URI (today's existing
//          behavior) when it isn't, rather than failing the request.
// @route   POST /api/v1/uploads/image
export const uploadImage = asyncHandler(async (req: TenantRequest, res: Response) => {
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) {
        return res.status(400).json(new ApiResponse(400, null, 'No image file provided'));
    }

    if (isCloudinaryConfigured()) {
        const cloudinary = getCloudinaryClient()!;
        try {
            const result = await new Promise<any>((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    { folder: `store360/${req.tenantId}`, resource_type: 'image' },
                    (error, uploadResult) => (error ? reject(error) : resolve(uploadResult))
                );
                stream.end(file.buffer);
            });
            return res
                .status(200)
                .json(new ApiResponse(200, { url: result.secure_url, provider: 'cloudinary' }, 'Image uploaded'));
        } catch (err: any) {
            return res
                .status(502)
                .json(new ApiResponse(502, null, `Cloud storage upload failed: ${err.message || 'unknown error'}`));
        }
    }

    const dataUri = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    res.status(200).json(
        new ApiResponse(200, { url: dataUri, provider: 'inline' }, 'Cloud storage not configured — stored inline')
    );
});
