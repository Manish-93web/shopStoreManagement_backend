import Wallet from '../models/Wallet.js';
import Customer from '../models/Customer.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/apiResponse.js';
// @desc    Top-up customer wallet
// @route   POST /api/wallets/top-up
export const topUpWallet = asyncHandler(async (req, res) => {
    const { customerId, amount, paymentMethod = 'Cash' } = req.body;
    if (amount <= 0) {
        return res.status(400).json(new ApiResponse(400, null, "Amount must be greater than 0"));
    }
    let wallet = await Wallet.findOne({ customer: customerId, storeId: req.tenantId });
    if (!wallet) {
        wallet = new Wallet({ customer: customerId, storeId: req.tenantId, balance: 0 });
    }
    wallet.balance += amount;
    wallet.transactions.push({
        type: 'CREDIT',
        amount,
        reason: `Top-up via ${paymentMethod}`,
        date: new Date()
    });
    await wallet.save();
    // Also sync the Customer legacy balance field
    await Customer.findByIdAndUpdate(customerId, { $inc: { walletBalance: amount } });
    res.status(200).json(new ApiResponse(200, wallet, "Wallet topped up successfully"));
});
// @desc    Get customer wallet details
// @route   GET /api/wallets/customer/:customerId
export const getWallet = asyncHandler(async (req, res) => {
    const wallet = await Wallet.findOne({ customer: req.params.customerId, storeId: req.tenantId });
    if (!wallet) {
        return res.status(200).json(new ApiResponse(200, { balance: 0, transactions: [] }, "Wallet not found"));
    }
    res.status(200).json(new ApiResponse(200, wallet));
});
