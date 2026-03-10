import express from 'express';
import { getSettings, updateSettings } from '../controllers/settingsController.js';
import { protect, authorize } from '../middleware/auth.js';
import { tenantHandler } from '../middleware/tenantHandler.js';
const router = express.Router();
router.use(protect);
router.use(tenantHandler);
router.route('/')
    .get(getSettings)
    .put(authorize('STORE_OWNER'), updateSettings);
export default router;
