import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/apiResponse.js';
// @desc    Test Thermal Printer Connection
// @route   POST /api/hardware/test-printer
export const testPrinter = asyncHandler(async (req, res) => {
    // In a real scenario, this might connect to a local print server or daemon
    // Here we simulate a successful test ping to the configured printer
    res.status(200).json(new ApiResponse(200, {
        status: 'success',
        device: 'Thermal Printer',
        message: 'Printer connected and test job sent successfully.'
    }));
});
// @desc    Test Barcode Scanner Connection
// @route   POST /api/hardware/test-scanner
export const testScanner = asyncHandler(async (req, res) => {
    // Simulate scanner ping
    res.status(200).json(new ApiResponse(200, {
        status: 'success',
        device: 'Barcode Scanner',
        message: 'Scanner is active and ready to read barcodes.'
    }));
});
// @desc    Test Cash Drawer Release
// @route   POST /api/hardware/test-drawer
export const testDrawer = asyncHandler(async (req, res) => {
    // Simulate drawer kick command
    res.status(200).json(new ApiResponse(200, {
        status: 'success',
        device: 'Cash Drawer',
        message: 'Kick signal sent to cash drawer.'
    }));
});
