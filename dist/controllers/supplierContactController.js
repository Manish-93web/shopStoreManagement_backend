import SupplierContact from '../models/SupplierContact.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/apiResponse.js';
// @desc    Get contact log for a supplier
// @route   GET /api/supplier-contacts/supplier/:supplierId
export const getSupplierContacts = asyncHandler(async (req, res) => {
    const contacts = await SupplierContact.find({
        supplierId: req.params.supplierId,
        storeId: req.tenantId,
    })
        .populate('loggedBy', 'name')
        .sort({ contactedAt: -1 });
    res.status(200).json(new ApiResponse(200, contacts));
});
// @desc    Log a contact/communication entry against a supplier
// @route   POST /api/supplier-contacts
export const createSupplierContact = asyncHandler(async (req, res) => {
    const contact = await SupplierContact.create({
        ...req.body,
        storeId: req.tenantId,
        loggedBy: req.user._id,
    });
    res.status(201).json(new ApiResponse(201, contact, 'Contact entry logged'));
});
// @desc    Delete a contact log entry
// @route   DELETE /api/supplier-contacts/:id
export const deleteSupplierContact = asyncHandler(async (req, res) => {
    const contact = await SupplierContact.findOneAndDelete({ _id: req.params.id, storeId: req.tenantId });
    if (!contact) {
        return res.status(404).json(new ApiResponse(404, null, 'Contact entry not found'));
    }
    res.status(200).json(new ApiResponse(200, null, 'Contact entry deleted'));
});
