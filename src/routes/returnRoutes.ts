import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { tenantHandler } from '../middleware/tenantHandler.js';
import { returnController } from '../controllers/returnController.js';

const router = express.Router();

router.use(protect, tenantHandler);

router.route('/')
    .get(returnController.getReturns)
    .post(returnController.createReturn);

export default router;
