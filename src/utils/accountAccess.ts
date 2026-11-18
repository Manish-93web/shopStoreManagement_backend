import Store from '../models/Store.js';

// Tenants that are still Pending approval, or Suspended, cannot sign in. Super Admins have no store.
// Returns the store's status when sign-in must be refused, or null when it is allowed.
export const signInBlockedStatus = async (user: {
    role?: string;
    storeId?: any;
    stores?: any[];
}): Promise<string | null> => {
    if (user.role === 'SUPER_ADMIN') return null;
    const storeIds = user.storeId ? [user.storeId] : user.stores || [];
    if (storeIds.length === 0) return null;
    const stores = await Store.find({ _id: { $in: storeIds } }).select('status isActive');
    if (stores.length === 0) return null;
    const canSignIn = stores.some((s) => s.status === 'Approved' && s.isActive !== false);
    return canSignIn ? null : stores[0].status;
};
