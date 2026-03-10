import express from 'express';
import { getTaxRules, createTaxRule, updateTaxRule } from '../controllers/taxRuleController.js';
import { protect, authorize } from '../middleware/auth.js';
import { tenantHandler } from '../middleware/tenantHandler.js';
const router = express.Router();
router.use(protect);
router.use(tenantHandler);
router.route('/')
    .get(getTaxRules)
    .post(authorize('STORE_OWNER'), createTaxRule);
router.route('/:id')
    .put(authorize('STORE_OWNER'), updateTaxRule);
export default router;
