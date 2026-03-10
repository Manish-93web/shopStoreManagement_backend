import express from 'express';
import { protect } from '../middleware/auth.js';
import { tenantHandler } from '../middleware/tenantHandler.js';
import { notificationController } from '../controllers/notificationController.js';
const router = express.Router();
router.use(protect, tenantHandler);
router.get('/', notificationController.getNotifications);
router.put('/read-all', notificationController.markAsRead);
export default router;
