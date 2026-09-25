import express from 'express';
import { protect } from '../middleware/auth.js';
import { tenantHandler } from '../middleware/tenantHandler.js';
import { checkTrialExpiry } from '../middleware/usageLimits.js';
import { requirePermission } from '../middleware/permissions.js';
import { getSalesReport, getTopSellingProducts, getLowStockReport, getProfitReport, getTaxReport, getInventoryReport, getCustomerReport, getRevenueReport, getTaxComplianceReport, getCashReconciliationReport, getSalesAuditTrail, getInventoryAuditReport, queueReport, exportReport, } from '../controllers/reportController.js';
const router = express.Router();
router.use(protect, tenantHandler, checkTrialExpiry);
// Low-stock and raw inventory counts stay ungated — Inventory Staff need those
// for restocking regardless of whether they can see financial reports. The
// revenue/profit/tax/audit-trail reports below are the sensitive ones.
router.get('/low-stock', getLowStockReport);
router.get('/inventory', getInventoryReport);
const viewReports = requirePermission('view_reports');
router.get('/sales', viewReports, getSalesReport);
router.get('/top-products', viewReports, getTopSellingProducts);
router.get('/profit', viewReports, getProfitReport);
router.get('/tax', viewReports, getTaxReport);
router.get('/customers', viewReports, getCustomerReport);
router.get('/revenue', viewReports, getRevenueReport);
router.get('/tax-compliance', viewReports, getTaxComplianceReport);
router.get('/cash-reconciliation', viewReports, getCashReconciliationReport);
router.get('/audit/sales', viewReports, getSalesAuditTrail);
router.get('/audit/inventory', viewReports, getInventoryAuditReport);
router.get('/export', viewReports, exportReport);
router.post('/queue', viewReports, queueReport);
export default router;
