import express from 'express';
import { protect } from '../middleware/auth.js';
import { tenantHandler } from '../middleware/tenantHandler.js';
import { notificationController } from '../controllers/notificationController.js';

const router = express.Router();

router.use(protect, tenantHandler);

router.get('/', notificationController.getNotifications);
router.put('/read-all', notificationController.markAsRead);
router.get('/settings', notificationController.getSettings);
router.put('/settings', notificationController.updateSettings);
router.post('/send', notificationController.sendManual);

export default router;
