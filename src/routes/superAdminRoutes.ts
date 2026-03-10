import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { getSystemStats, getAllStores } from '../controllers/superAdminController.js';

const router = express.Router();

router.use(protect);
router.use(authorize('SUPER_ADMIN'));

router.get('/stats', getSystemStats);
router.get('/stores', getAllStores);

export default router;
