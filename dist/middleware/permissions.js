import ApiResponse from '../utils/apiResponse.js';
// Fine-grained, per-employee toggles for a handful of actions that today have
// no role gate at all (any authenticated role — including Cashier — can
// cancel any order, process any return, or view profit/audit reports). This
// is a deny-list, not an allow-list: an employee with no restrictions behaves
// exactly as before. Only a Store Owner can set these (see employeeRoutes.ts).
export const RESTRICTABLE_PERMISSIONS = ['cancel_orders', 'process_returns', 'view_reports'];
const PERMISSION_LABELS = {
    cancel_orders: 'cancel orders',
    process_returns: 'process returns',
    view_reports: 'view reports',
};
export const requirePermission = (key) => {
    return (req, res, next) => {
        const role = req.user?.role;
        // Store Owner, Super Admin, and Manager keep the full access they
        // already have everywhere else in the app — these toggles only ever
        // narrow Cashier / Inventory Staff, the two roles that don't already
        // carry blanket trust via authorize('STORE_OWNER', 'MANAGER').
        if (role !== 'CASHIER' && role !== 'INVENTORY_STAFF')
            return next();
        if (req.user?.restrictedPermissions?.includes(key)) {
            return res
                .status(403)
                .json(new ApiResponse(403, null, `You don't have permission to ${PERMISSION_LABELS[key]}`));
        }
        next();
    };
};
