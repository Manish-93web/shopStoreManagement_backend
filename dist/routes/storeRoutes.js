import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { getStores, toggleStoreStatus } from '../controllers/storeController.js';
const router = express.Router();
router.use(protect);
router.route('/')
    .get(authorize('SUPER_ADMIN'), getStores);
router.route('/:id/toggle')
    .patch(authorize('SUPER_ADMIN'), toggleStoreStatus);
export default router;
