import express from 'express';
import { protect } from '../middleware/auth.js';
import { tenantHandler } from '../middleware/tenantHandler.js';
import {
    createScheduledMessage,
    getScheduledMessages,
    cancelScheduledMessage,
    markScheduledMessageSent,
} from '../controllers/scheduledMessageController.js';

const router = express.Router();

router.use(protect, tenantHandler);

router.route('/').post(createScheduledMessage).get(getScheduledMessages);

router.route('/:id/cancel').put(cancelScheduledMessage);
router.route('/:id/mark-sent').put(markScheduledMessageSent);

export default router;
