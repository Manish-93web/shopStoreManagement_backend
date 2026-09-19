import { Response } from 'express';
import PDFDocument from 'pdfkit';
import PurchaseOrder from '../models/PurchaseOrder.js';
import Inventory from '../models/Inventory.js';
import Product from '../models/Product.js';
import ProductVariant from '../models/ProductVariant.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/apiResponse.js';
import { TenantRequest } from '../middleware/tenantHandler.js';
import { notificationService } from '../services/notificationService.js';
import Store from '../models/Store.js';
import { bumpCacheVersion } from '../config/redis.js';
import { emitToStore } from '../config/socket.js';

// @desc    Create a new Purchase Order
// @route   POST /api/purchase-orders
export const createPurchaseOrder = asyncHandler(async (req: TenantRequest, res: Response) => {
    const poData = {
        ...req.body,
        poNumber: `PO-${Date.now()}`,
        storeId: req.tenantId,
        createdBy: req.user._id,
    };

    const po = await PurchaseOrder.create(poData);
    res.status(201).json(new ApiResponse(201, po, 'Purchase Order created'));
});

// @desc    Approve a Purchase Order
// @route   PUT /api/purchase-orders/:id/approve
export const approvePurchaseOrder = asyncHandler(async (req: TenantRequest, res: Response) => {
    const po = await PurchaseOrder.findOne({ _id: req.params.id, storeId: req.tenantId });

    if (!po) {
        return res.status(404).json(new ApiResponse(404, null, 'Purchase Order not found'));
    }

    if (po.status !== 'Draft' && po.status !== 'Sent') {
        return res.status(400).json(new ApiResponse(400, null, `Cannot approve PO with status: ${po.status}`));
    }

    po.status = 'Approved';
    await po.save();

    // Notify PO Creator
    const store = await Store.findById(req.tenantId);
    await notificationService.send({
        recipientId: po.createdBy.toString(),
        storeId: req.tenantId!.toString(),
        title: 'Purchase Order Approved',
        message: `Your Purchase Order ${po.poNumber} has been approved.`,
        type: 'SUCCESS',
    });

    res.status(200).json(new ApiResponse(200, po, 'Purchase Order approved'));
});

// @desc    Receive inventory from an approved PO — supports partial/short receiving.
//          Body: { items?: [{ productId, variantId?, receivedQty }] } — if omitted,
//          receives the full outstanding quantity for every item (matches the
//          previous "Receive Goods" one-click behavior).
// @route   PUT /api/purchase-orders/:id/receive
export const receivePurchaseOrder = asyncHandler(async (req: TenantRequest, res: Response) => {
    const po = await PurchaseOrder.findOne({ _id: req.params.id, storeId: req.tenantId });

    if (!po || po.status === 'Received' || po.status === 'Cancelled') {
        return res.status(400).json(new ApiResponse(400, null, 'Invalid PO or already fully received'));
    }

    const receivedInput: { productId: string; variantId?: string; receivedQty: number }[] = req.body.items;

    // Update inventory for each item
    for (const item of po.items) {
        const outstanding = item.quantity - (item.receivedQuantity || 0);
        if (outstanding <= 0) continue;

        let receiveNow = outstanding; // default: receive everything still outstanding
        if (receivedInput) {
            const match = receivedInput.find(
                (i) =>
                    i.productId === item.product.toString() &&
                    (i.variantId || undefined) === (item.variant?.toString() || undefined)
            );
            receiveNow = match ? Math.max(0, Math.min(match.receivedQty, outstanding)) : 0;
        }
        if (receiveNow <= 0) continue;

        // Increment inventory
        const inv = await Inventory.findOneAndUpdate(
            { product: item.product, store: req.tenantId },
            { $inc: { quantity: receiveNow } },
            { upsert: true, new: true }
        );

        item.receivedQuantity = (item.receivedQuantity || 0) + receiveNow;

        // Standardize cost price update
        if (item.variant) {
            await ProductVariant.findByIdAndUpdate(item.variant, { $set: { costPrice: item.costPrice } });
        } else {
            await Product.findByIdAndUpdate(item.product, { $set: { costPrice: item.costPrice } });
        }

        emitToStore(req.tenantId!.toString(), 'inventory-update', {
            productId: item.product,
            variantId: item.variant,
            newQuantity: inv?.quantity,
        });
    }
    await bumpCacheVersion(req.tenantId!.toString());

    const fullyReceived = po.items.every((item) => (item.receivedQuantity || 0) >= item.quantity);
    po.status = fullyReceived ? 'Received' : 'Partially Received';
    if (fullyReceived) po.receivedAt = new Date();
    po.markModified('items');
    await po.save();

    // Notify Owner
    const store = await Store.findById(req.tenantId);
    if (store) {
        await notificationService.send({
            recipientId: store.owner.toString(),
            storeId: req.tenantId!.toString(),
            title: fullyReceived ? 'Inventory Restocked (PO Received)' : 'Partial Delivery Received',
            message: fullyReceived
                ? `PO ${po.poNumber} has been fully received. Stocks updated.`
                : `PO ${po.poNumber} was partially received. Stocks updated for the items delivered.`,
            type: 'SUCCESS',
        });
    }

    res.status(200).json(
        new ApiResponse(200, po, fullyReceived ? 'Purchase Order fully received' : 'Purchase Order partially received')
    );
});

// @desc    Get all purchase orders
// @route   GET /api/purchase-orders
export const getPurchaseOrders = asyncHandler(async (req: TenantRequest, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    const status = (req.query.status as string)?.trim();
    const supplier = (req.query.supplier as string)?.trim();
    const search = (req.query.search as string)?.trim();
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    const query: any = { storeId: req.tenantId };
    if (status) query.status = status;
    if (supplier) query.supplier = supplier;
    if (search) query.poNumber = { $regex: search, $options: 'i' };
    if (startDate && endDate) {
        query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const [pos, total] = await Promise.all([
        PurchaseOrder.find(query).populate('supplier', 'name').sort({ createdAt: -1 }).skip(skip).limit(limit),
        PurchaseOrder.countDocuments(query),
    ]);

    res.status(200).json(
        new ApiResponse(200, {
            purchaseOrders: pos,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            },
        })
    );
});

// @desc    Generate a PDF invoice/document for a Purchase Order
// @route   GET /api/purchase-orders/:id/invoice
export const generatePurchaseOrderInvoice = asyncHandler(async (req: TenantRequest, res: Response) => {
    const po = await PurchaseOrder.findOne({ _id: req.params.id, storeId: req.tenantId }).populate('supplier');
    if (!po) {
        return res.status(404).json(new ApiResponse(404, null, 'Purchase Order not found'));
    }
    const store = await Store.findById(req.tenantId);
    const supplier: any = po.supplier;

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${po.poNumber}.pdf`);
    doc.pipe(res);

    doc.fontSize(20).text(store?.name || 'Store360', { align: 'left' });
    doc.fontSize(9)
        .fillColor('#555')
        .text(
            [store?.address, store?.phone, store?.email, store?.gstin ? `GSTIN: ${store.gstin}` : null]
                .filter(Boolean)
                .join(' | ')
        );
    doc.moveDown(1.5);

    doc.fillColor('#000').fontSize(16).text('PURCHASE ORDER', { align: 'right' });
    doc.fontSize(10).fillColor('#555').text(`PO Number: ${po.poNumber}`, { align: 'right' });
    doc.text(`Date: ${new Date(po.createdAt).toLocaleDateString()}`, { align: 'right' });
    doc.text(`Status: ${po.status}`, { align: 'right' });
    doc.moveDown(1);

    doc.fillColor('#000').fontSize(11).text('Supplier', { underline: true });
    doc.fontSize(10).fillColor('#333');
    doc.text(supplier?.name || 'Unknown Supplier');
    if (supplier?.contactPerson) doc.text(supplier.contactPerson);
    if (supplier?.phone) doc.text(supplier.phone);
    if (supplier?.email) doc.text(supplier.email);
    if (supplier?.address) doc.text(supplier.address);
    doc.moveDown(1.5);

    const tableTop = doc.y;
    const cols = { name: 50, qty: 260, received: 330, cost: 400, total: 470 };
    doc.fillColor('#000').fontSize(9);
    doc.text('Item', cols.name, tableTop);
    doc.text('Qty', cols.qty, tableTop);
    doc.text('Received', cols.received, tableTop);
    doc.text('Cost', cols.cost, tableTop);
    doc.text('Total', cols.total, tableTop);
    doc.moveTo(50, tableTop + 15)
        .lineTo(545, tableTop + 15)
        .strokeColor('#ccc')
        .stroke();

    let y = tableTop + 22;
    po.items.forEach((item) => {
        doc.fillColor('#333').fontSize(9);
        doc.text(item.name, cols.name, y, { width: 200 });
        doc.text(String(item.quantity), cols.qty, y);
        doc.text(String(item.receivedQuantity || 0), cols.received, y);
        doc.text(item.costPrice.toFixed(2), cols.cost, y);
        doc.text(item.total.toFixed(2), cols.total, y);
        y += 20;
    });

    doc.moveTo(50, y + 5)
        .lineTo(545, y + 5)
        .strokeColor('#ccc')
        .stroke();
    y += 15;
    doc.fillColor('#000')
        .fontSize(10)
        .text(`Subtotal: ${po.subTotal.toFixed(2)}`, cols.total - 60, y, { align: 'right' });
    y += 15;
    doc.text(`Tax: ${po.taxTotal.toFixed(2)}`, cols.total - 60, y, { align: 'right' });
    y += 15;
    doc.fontSize(12).text(`Grand Total: ${po.grandTotal.toFixed(2)}`, cols.total - 60, y, { align: 'right' });

    doc.end();
});
