import express from 'express';
import { protect } from '../middleware/auth.js';
import { tenantHandler } from '../middleware/tenantHandler.js';
import {
    getGeneralLedger,
    exportAccountingData
} from '../controllers/accountingController.js';

const router = express.Router();

router.use(protect, tenantHandler);

router.get('/ledger', getGeneralLedger);
router.get('/export', exportAccountingData);

export default router;
