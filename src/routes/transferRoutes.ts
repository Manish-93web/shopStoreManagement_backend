import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { tenantHandler } from '../middleware/tenantHandler.js';
import {
    createTransfer,
    shipTransfer,
    receiveTransfer,
    getTransfers
} from '../controllers/transferController.js';

const router = express.Router();

router.use(protect, tenantHandler);

router.route('/')
    .post(authorize('Owner', 'Manager'), createTransfer)
    .get(getTransfers);

router.route('/:id/send')
    .put(authorize('Owner', 'Manager'), shipTransfer);

router.route('/:id/receive')
    .put(authorize('Owner', 'Manager'), receiveTransfer);

export default router;
