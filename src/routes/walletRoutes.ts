import express from 'express';
import { protect } from '../middleware/auth.js';
import { tenantHandler } from '../middleware/tenantHandler.js';
import { topUpWallet, getWallet } from '../controllers/walletController.js';

const router = express.Router();

router.use(protect, tenantHandler);

router.post('/top-up', topUpWallet);
router.get('/customer/:customerId', getWallet);

export default router;
