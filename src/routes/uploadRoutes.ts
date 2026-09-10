import express from 'express';
import multer from 'multer';
import { protect } from '../middleware/auth.js';
import { tenantHandler } from '../middleware/tenantHandler.js';
import { uploadImage } from '../controllers/uploadController.js';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, WEBP, and GIF images are allowed.'));
        }
    },
});

const router = express.Router();

router.use(protect, tenantHandler);

router.post('/image', upload.single('image'), uploadImage);

export default router;
