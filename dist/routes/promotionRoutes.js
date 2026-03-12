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
router.get('/coupons', authorize('Owner', 'Manager'), promotionController.getCoupons);
router.post('/coupons', authorize('Owner', 'Manager'), promotionController.createCoupon);
router.get('/rules', authorize('Owner', 'Manager'), promotionController.getRules);
router.post('/rules', authorize('Owner', 'Manager'), promotionController.createRule);
export default router;
