import Coupon from '../models/Coupon.js';
import PromotionRule from '../models/PromotionRule.js';
import Order from '../models/Order.js';
export const promotionService = {
    /**
     * Validate and Apply Coupon
     */
    validateCoupon: async (code, cartTotal, cartItems, customerId, storeId) => {
        const coupon = await Coupon.findOne({
            code: code.toUpperCase(),
            storeId,
            isActive: true,
            validFrom: { $lte: new Date() },
            validTo: { $gte: new Date() },
        });
        if (!coupon)
            throw new Error('Invalid or expired coupon code');
        // Usage Limits Check
        if (coupon.usageLimitTotal && coupon.usageCount >= coupon.usageLimitTotal) {
            throw new Error('Coupon usage limit reached');
        }
        if (customerId && coupon.usageLimitPerCustomer) {
            const customerUsage = await Order.countDocuments({
                customer: customerId,
                storeId,
                'discountDetails.code': code.toUpperCase(),
            });
            if (customerUsage >= coupon.usageLimitPerCustomer) {
                throw new Error('You have already used this coupon');
            }
        }
        if (cartTotal < coupon.minPurchaseAmount) {
            throw new Error(`Minimum purchase of ₹${coupon.minPurchaseAmount} required`);
        }
        let discountAmount;
        if (coupon.discountType === 'Percentage') {
            discountAmount = (cartTotal * coupon.discountValue) / 100;
            if (coupon.maxDiscountAmount && discountAmount > coupon.maxDiscountAmount) {
                discountAmount = coupon.maxDiscountAmount;
            }
        }
        else if (coupon.discountType === 'BOGO') {
            // "Buy X, get Y free" — free units come off the cheapest eligible
            // units in the cart (the conservative, standard retail convention),
            // not an arbitrary item, so the discount is deterministic regardless
            // of cart order.
            const buyQty = coupon.buyQuantity || 1;
            const getQty = coupon.getQuantity || 1;
            const unitPrices = [];
            for (const item of cartItems || []) {
                for (let n = 0; n < (item.quantity || 0); n++)
                    unitPrices.push(item.price || 0);
            }
            unitPrices.sort((a, b) => a - b);
            const freeUnitCount = Math.floor(unitPrices.length / (buyQty + getQty)) * getQty;
            if (freeUnitCount <= 0) {
                throw new Error(`Add at least ${buyQty + getQty} item(s) to the cart to use this BOGO offer`);
            }
            discountAmount = unitPrices.slice(0, freeUnitCount).reduce((sum, p) => sum + p, 0);
        }
        else {
            discountAmount = coupon.discountValue;
        }
        return {
            couponId: coupon._id,
            discountAmount,
            type: coupon.discountType,
            value: coupon.discountValue,
        };
    },
    /**
     * Get Best Automatic Promotion
     */
    evaluateAutomaticPromotions: async (cartTotal, cartItems, storeId) => {
        const now = new Date();
        const rules = await PromotionRule.find({
            storeId,
            isActive: true,
            $or: [
                { validFrom: { $lte: now }, validTo: { $gte: now } },
                { validFrom: { $exists: false }, validTo: { $exists: false } },
                { validFrom: null, validTo: null },
            ],
        }).sort({ priority: -1 });
        // Simple implementation: choose first applicable rule by priority
        for (const rule of rules) {
            if (rule.triggerType === 'TotalCartValue' && cartTotal >= rule.threshold) {
                let discountAmount;
                if (rule.discountType === 'Percentage') {
                    discountAmount = (cartTotal * rule.discountValue) / 100;
                }
                else {
                    discountAmount = rule.discountValue;
                }
                return {
                    ruleId: rule._id,
                    name: rule.name,
                    discountAmount,
                };
            }
            if (rule.triggerType === 'CategorySpecific' || rule.triggerType === 'ProductSpecific') {
                const targetItems = cartItems.filter((item) => rule.triggerType === 'CategorySpecific'
                    ? item.category === rule.targetId?.toString()
                    : item.product === rule.targetId?.toString());
                if (targetItems.length > 0) {
                    const targetTotal = targetItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
                    if (targetTotal >= rule.threshold) {
                        let discountAmount;
                        if (rule.discountType === 'Percentage') {
                            discountAmount = (targetTotal * rule.discountValue) / 100;
                        }
                        else {
                            discountAmount = rule.discountValue;
                        }
                        return {
                            ruleId: rule._id,
                            name: rule.name,
                            discountAmount,
                        };
                    }
                }
            }
        }
        return null;
    },
};
