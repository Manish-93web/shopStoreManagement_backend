import Customer from '../models/Customer.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/apiResponse.js';
// @desc    Add loyalty points to customer
// @route   POST /api/customers/:id/loyalty
export const updateLoyaltyPoints = asyncHandler(async (req, res) => {
    const { points, action } = req.body; // action: 'add' or 'redeem'
    const customer = await Customer.findOne({ _id: req.params.id, storeId: req.tenantId });
    if (!customer) {
        return res.status(404).json(new ApiResponse(404, null, "Customer not found"));
    }
    if (action === 'redeem' && customer.loyaltyPoints < points) {
        return res.status(400).json(new ApiResponse(400, null, "Insufficient points"));
    }
    const newPoints = action === 'add'
        ? customer.loyaltyPoints + points
        : customer.loyaltyPoints - points;
    customer.loyaltyPoints = newPoints;
    await customer.save();
    res.status(200).json(new ApiResponse(200, customer, `Points ${action}ed successfully`));
});
// @desc    Get all customers
// @route   GET /api/customers
export const getCustomers = asyncHandler(async (req, res) => {
    const customers = await Customer.find({ storeId: req.tenantId });
    res.status(200).json(new ApiResponse(200, customers));
});
// @desc    Create a new customer
// @route   POST /api/customers
export const createCustomer = asyncHandler(async (req, res) => {
    const customer = await Customer.create({ ...req.body, storeId: req.tenantId });
    res.status(201).json(new ApiResponse(201, customer));
});
