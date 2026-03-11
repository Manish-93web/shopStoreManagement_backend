import express from 'express';
import { protect } from '../middleware/auth.js';
import { tenantHandler } from '../middleware/tenantHandler.js';
import { getCustomers, createCustomer, updateLoyaltyPoints, getCustomerById, updateCustomer, deleteCustomer, updateWalletBalance, getCustomerAnalytics, exportCustomers, importCustomers } from '../controllers/customerController.js';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });

const router = express.Router();

router.use(protect, tenantHandler);

router.route('/')
    .get(getCustomers)
    .post(createCustomer);

router.get('/analytics/summary', getCustomerAnalytics);
router.get('/export', exportCustomers);
router.post('/import', upload.single('file'), importCustomers);

router.route('/:id')
    .get(getCustomerById)
    .put(updateCustomer)
    .delete(deleteCustomer);

router.route('/:id/loyalty')
    .post(updateLoyaltyPoints);

router.route('/:id/wallet')
    .post(updateWalletBalance);

export default router;
