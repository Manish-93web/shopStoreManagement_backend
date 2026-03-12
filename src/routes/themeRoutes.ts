import express from 'express';
import { getTheme, saveTheme } from '../controllers/themeController.js';
import { protect } from '../middleware/auth.js';
import { tenantHandler } from '../middleware/tenantHandler.js';

const router = express.Router();

router.use(protect);
router.use(tenantHandler);

router.route('/')
    .get(getTheme)
    .put(saveTheme);

export default router;
