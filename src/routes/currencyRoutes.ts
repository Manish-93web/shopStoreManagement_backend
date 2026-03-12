import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { tenantHandler } from '../middleware/tenantHandler.js';
import { currencyController } from '../controllers/currencyController.js';

const router = express.Router();

router.use(protect, tenantHandler);

router.get('/', currencyController.getCurrencies);
router.post('/', authorize('Owner', 'Manager'), currencyController.createCurrency);
router.put('/:id', authorize('Owner', 'Manager'), currencyController.updateCurrency);

export default router;
