import express from 'express';
import { protect } from '../middleware/auth.js';
import { tenantHandler } from '../middleware/tenantHandler.js';
import { checkTrialExpiry } from '../middleware/usageLimits.js';
import { sanitizeFields } from '../middleware/sanitize.js';
import {
    getSupplierContacts,
    createSupplierContact,
    deleteSupplierContact,
} from '../controllers/supplierContactController.js';

const router = express.Router();

router.use(protect, tenantHandler, checkTrialExpiry);

router.post('/', sanitizeFields('summary'), createSupplierContact);
router.get('/supplier/:supplierId', getSupplierContacts);
router.delete('/:id', deleteSupplierContact);

export default router;
