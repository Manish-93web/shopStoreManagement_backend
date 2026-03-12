import express from 'express';
import { requireApiKey, requirePermission } from '../middleware/apiKeyMiddleware.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
const router = express.Router();
// Apply API Key Validation to all public routes
router.use(requireApiKey);
// Example Public Endpoint: Get Products
router.get('/products', requirePermission('read:products'), async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const products = await Product.find({ storeId: req.tenantId })
            .select('name sku barcode price category description active')
            .limit(limit)
            .lean();
        res.json({ success: true, data: products });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});
// Example Public Endpoint: Create Order
router.post('/orders', requirePermission('write:orders'), async (req, res) => {
    try {
        // Basic example, in reality we'd use the full order creation logic
        const { items, grandTotal, paymentDetails } = req.body;
        const order = await Order.create({
            orderNumber: `EXT-${Date.now()}`,
            storeId: req.tenantId,
            items,
            grandTotal,
            paymentDetails
        });
        res.status(201).json({ success: true, data: order });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Server Error processing order' });
    }
});
export default router;
