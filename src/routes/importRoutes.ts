import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { tenantHandler } from '../middleware/tenantHandler.js';
import { importController } from '../controllers/importController.js';

const router = express.Router();

router.use(protect, tenantHandler);

router.post('/products', authorize('Owner', 'Manager'), importController.importProducts);

export default router;
