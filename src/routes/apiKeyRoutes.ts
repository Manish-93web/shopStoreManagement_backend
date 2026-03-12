import express from 'express';
import { getApiKeys, createApiKey, updateApiKey, deleteApiKey } from '../controllers/apiKeyController.js';
import { protect } from '../middleware/auth.js';
import { tenantHandler } from '../middleware/tenantHandler.js';

const router = express.Router();

router.use(protect);
router.use(tenantHandler);

router.route('/')
    .get(getApiKeys)
    .post(createApiKey);

router.route('/:id')
    .put(updateApiKey)
    .delete(deleteApiKey);

export default router;
