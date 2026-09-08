import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { tenantHandler } from '../middleware/tenantHandler.js';
import { promotionController } from '../controllers/promotionController.js';

const router = express.Router();

router.use(protect, tenantHandler);

// POS Usage
router.post('/validate', promotionController.validate);
router.post('/auto', promotionController.getAutoPromotions);

// Management
router.get('/coupons', authorize('STORE_OWNER', 'MANAGER'), promotionController.getCoupons);
router.post('/coupons', authorize('STORE_OWNER', 'MANAGER'), promotionController.createCoupon);
router.get('/rules', authorize('STORE_OWNER', 'MANAGER'), promotionController.getRules);
router.post('/rules', authorize('STORE_OWNER', 'MANAGER'), promotionController.createRule);

export default router;
