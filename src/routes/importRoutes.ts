import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { tenantHandler } from '../middleware/tenantHandler.js';
import { importController } from '../controllers/importController.js';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

router.use(protect, tenantHandler);

router.post('/products', authorize('Owner', 'Manager'), upload.single('file'), importController.importProducts);

export default router;
