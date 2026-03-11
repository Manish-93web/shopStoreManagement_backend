import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { tenantHandler } from '../middleware/tenantHandler.js';
import { importController } from '../controllers/importController.js';
import multer from 'multer';

const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (_req, file, cb) => {
        const allowedTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/csv',
            'application/vnd.ms-excel'
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only Excel and CSV are allowed.'));
        }
    }
});
const router = express.Router();

router.use(protect, tenantHandler);

router.post('/products', protect, authorize('STORE_OWNER', 'ADMIN'), upload.single('file'), importController.importProducts);

export default router;
