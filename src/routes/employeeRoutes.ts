import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { tenantHandler } from '../middleware/tenantHandler.js';
import { getEmployees, createEmployee, updateEmployee, deleteEmployee, getStaffPerformance } from '../controllers/employeeController.js';

const router = express.Router();

router.use(protect, tenantHandler);

router.get('/performance', authorize('STORE_OWNER', 'MANAGER', 'SUPER_ADMIN'), getStaffPerformance);

router.route('/')
    .get(getEmployees)
    .post(authorize('STORE_OWNER', 'MANAGER'), createEmployee);

router.route('/:id')
    .put(authorize('Owner', 'Manager'), updateEmployee)
    .delete(authorize('Owner'), deleteEmployee);

export default router;
