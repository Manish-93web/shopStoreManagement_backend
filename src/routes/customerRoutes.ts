import express from 'express';
import { protect } from '../middleware/auth.js';
import { tenantHandler } from '../middleware/tenantHandler.js';
import { checkTrialExpiry } from '../middleware/usageLimits.js';
import {
    getCustomers,
    createCustomer,
    updateLoyaltyPoints,
    getCustomerById,
    updateCustomer,
    deleteCustomer,
    updateWalletBalance,
    recordDuePayment,
    getCustomersWithDues,
    logCustomerWhatsAppSent,
    getCustomerAnalytics,
    exportCustomers,
    importCustomers,
} from '../controllers/customerController.js';
import { sanitizeFields } from '../middleware/sanitize.js';
import multer from 'multer';

const ALLOWED_IMPORT_TYPES = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'application/vnd.ms-excel',
];
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (ALLOWED_IMPORT_TYPES.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only Excel and CSV are allowed.'));
        }
    },
});

const router = express.Router();

router.use(protect, tenantHandler, checkTrialExpiry);

router.route('/').get(getCustomers).post(sanitizeFields('notes'), createCustomer);

router.get('/analytics/summary', getCustomerAnalytics);
router.get('/export', exportCustomers);
router.get('/dues', getCustomersWithDues);
router.post('/import', upload.single('file'), importCustomers);

router.route('/:id').get(getCustomerById).put(sanitizeFields('notes'), updateCustomer).delete(deleteCustomer);

router.route('/:id/loyalty').post(updateLoyaltyPoints);

router.route('/:id/wallet').post(updateWalletBalance);

router.route('/:id/dues/payment').post(recordDuePayment);

router.route('/:id/whatsapp-log').post(logCustomerWhatsAppSent);

export default router;
