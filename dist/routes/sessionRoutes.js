import express from 'express';
import { protect } from '../middleware/auth.js';
import { tenantHandler } from '../middleware/tenantHandler.js';
import { sessionController } from '../controllers/sessionController.js';
const router = express.Router();
router.use(protect, tenantHandler);
router.post('/open', sessionController.openSession);
router.post('/close', sessionController.closeSession);
export default router;
