import express from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { requireApiKey, requirePermission } from '../middleware/apiKeyMiddleware.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
const router = express.Router();
// Apply API Key Validation to all public routes
router.use(requireApiKey);
// This surface sits outside the /api/v1 prefix the app-wide limiter covers, so
// it had no throttling of its own. Keyed by the validated API key (tenantId)
// rather than IP — a legitimate integration server can make many calls from
// one IP, while a leaked/abused key should still be capped regardless of
// which IP it's used from.
router.use(rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.tenantId || ipKeyGenerator(req.ip),
    message: { success: false, message: 'Too many requests for this API key, please try again later' },
}));
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
