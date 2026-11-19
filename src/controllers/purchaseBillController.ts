import { Response } from 'express';
import mongoose from 'mongoose';
import PurchaseBill from '../models/PurchaseBill.js';
import PurchaseReturn from '../models/PurchaseReturn.js';
import Product from '../models/Product.js';
import ProductVariant from '../models/ProductVariant.js';
import Supplier from '../models/Supplier.js';
import Store from '../models/Store.js';
import InventoryBatch from '../models/InventoryBatch.js';
import Settings from '../models/Settings.js';
import { cleanSerials, saveSerials, serialProblem } from '../utils/serialIntake.js';
import Inventory from '../models/Inventory.js';
import ApiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { TenantRequest } from '../middleware/tenantHandler.js';
import { bumpCacheVersion } from '../config/redis.js';
import { emitToStore } from '../config/socket.js';
import { inventoryFilter, recordPriceChange, recordStockMovement } from '../utils/stockMovement.js';

const round2 = (n: number) => Math.round(n * 100) / 100;

type LineInput = {
    product: string;
    variant?: string;
    quantity: number;
    rate: number;
    gstRate?: number;
    batchNumber?: string;
    mfgDate?: string;
    expiryDate?: string;
    serialNumbers?: string[];
};

// Tax for each line: CGST+SGST (half each) inside the state, IGST for another state.
const buildLines = async (storeId: any, lines: LineInput[], isInterState: boolean, requireBatch = false) => {
    const products = await Product.find({ _id: { $in: lines.map((l) => l.product) }, storeId }).select(
        'name hsnCode taxRate trackBatch trackSerial'
    );
    const byId = new Map(products.map((p) => [p._id.toString(), p]));
    const out: any[] = [];
    for (const l of lines) {
        const p = byId.get(String(l.product));
        if (!p) throw new Error('A product on the bill was not found.');
        if (!(Number(l.quantity) > 0)) throw new Error(`Enter a quantity for "${p.name}".`);
        if (!(Number(l.rate) >= 0)) throw new Error(`Enter the rate for "${p.name}".`);
        const gstRate = Number.isFinite(Number(l.gstRate)) ? Number(l.gstRate) : p.taxRate || 0;
        // Phones, appliances: one serial / IMEI per unit, and none already in the store.
        let serials: string[] = [];
        if (requireBatch && p.trackSerial) {
            serials = cleanSerials(l.serialNumbers);
            const problem = await serialProblem(storeId, serials, Number(l.quantity), p.name);
            if (problem) throw new Error(problem);
        }
        // Medicine / food: the batch number and expiry date printed on the pack are required.
        if (requireBatch && p.trackBatch && (!l.batchNumber?.trim() || !l.expiryDate)) {
            throw new Error(`Enter the batch number and expiry date for "${p.name}".`);
        }
        const taxable = round2(l.quantity * l.rate);
        const tax = round2((taxable * gstRate) / 100);
        out.push({
            product: p._id,
            variant: l.variant || undefined,
            name: p.name,
            hsnCode: p.hsnCode,
            quantity: l.quantity,
            rate: l.rate,
            gstRate,
            serialNumbers: serials,
            batchNumber: l.batchNumber?.trim() || undefined,
            mfgDate: l.mfgDate ? new Date(l.mfgDate) : undefined,
            expiryDate: l.expiryDate ? new Date(l.expiryDate) : undefined,
            taxable,
            cgst: isInterState ? 0 : round2(tax / 2),
            sgst: isInterState ? 0 : round2(tax / 2),
            igst: isInterState ? tax : 0,
            total: round2(taxable + tax),
        });
    }
    return out;
};

export const sumLines = (items: any[]) => {
    const taxableTotal = round2(items.reduce((s, i) => s + i.taxable, 0));
    const cgstTotal = round2(items.reduce((s, i) => s + i.cgst, 0));
    const sgstTotal = round2(items.reduce((s, i) => s + i.sgst, 0));
    const igstTotal = round2(items.reduce((s, i) => s + i.igst, 0));
    const taxTotal = round2(cgstTotal + sgstTotal + igstTotal);
    return { taxableTotal, cgstTotal, sgstTotal, igstTotal, taxTotal, grandTotal: round2(taxableTotal + taxTotal) };
};

// @desc    Enter a supplier's tax invoice (optionally receiving the stock with it)
// @route   POST /api/purchase-bills
export const createPurchaseBill = asyncHandler(async (req: TenantRequest, res: Response) => {
    const { supplier, billNumber, billDate, supplierGstin, items, notes } = req.body;
    const receiveStock = req.body.receiveStock !== false;

    if (!supplier || !billNumber?.trim() || !billDate) {
        return res.status(400).json(new ApiResponse(400, null, 'Supplier, bill number and bill date are required.'));
    }
    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json(new ApiResponse(400, null, 'Add at least one product to the bill.'));
    }
    const supplierDoc = await Supplier.findOne({ _id: supplier, storeId: req.tenantId });
    if (!supplierDoc) return res.status(404).json(new ApiResponse(404, null, 'Supplier not found'));

    // Another state's GSTIN (first two digits are the state code) means IGST instead of CGST+SGST.
    const gstin = (supplierGstin || supplierDoc.gstin || '').trim().toUpperCase();
    let isInterState: boolean;
    if (typeof req.body.isInterState === 'boolean') isInterState = req.body.isInterState;
    else {
        const store = await Store.findById(req.tenantId).select('gstin');
        const mine = (store?.gstin || '').trim().slice(0, 2);
        isInterState = mine.length === 2 && gstin.length >= 2 && gstin.slice(0, 2) !== mine;
    }

    let lines;
    try {
        lines = await buildLines(req.tenantId, items, isInterState, receiveStock);
    } catch (e: any) {
        return res.status(400).json(new ApiResponse(400, null, e.message));
    }
    // Same serial listed on two lines of this bill would only be caught when saving — catch it now.
    const allSerials = lines.flatMap((l: any) => l.serialNumbers || []);
    if (new Set(allSerials).size !== allSerials.length) {
        return res.status(400).json(new ApiResponse(400, null, 'A serial number is listed twice on this bill.'));
    }
    const totals = sumLines(lines);
    // Round the bill total like the POS does, when the store has a rounding rule.
    const rounding = (await Settings.findOne({ storeId: req.tenantId }).select('taxConfig'))?.taxConfig?.roundingMode;
    const exact = totals.grandTotal;
    const rounded =
        rounding === 'nearest'
            ? Math.round(exact)
            : rounding === 'up'
              ? Math.ceil(exact - 1e-9)
              : rounding === 'down'
                ? Math.floor(exact + 1e-9)
                : exact;
    const roundOff = round2(rounded - exact);
    totals.grandTotal = round2(rounded);

    let bill;
    try {
        bill = await PurchaseBill.create({
            storeId: req.tenantId,
            supplier,
            billNumber: billNumber.trim(),
            billDate: new Date(billDate),
            supplierGstin: gstin || undefined,
            isInterState,
            items: lines,
            ...totals,
            roundOff,
            stockReceived: receiveStock,
            notes,
            createdBy: req.user?._id,
        });
    } catch (e: any) {
        if (e.code === 11000) {
            return res
                .status(409)
                .json(new ApiResponse(409, null, `Bill ${billNumber} is already entered for this supplier.`));
        }
        throw e;
    }

    if (receiveStock) {
        for (const line of lines) {
            await Inventory.findOneAndUpdate(
                inventoryFilter(req.tenantId as any, line.product, line.variant),
                { $inc: { quantity: line.quantity }, $set: { lastStockUpdate: new Date() } },
                { upsert: true }
            );
            await saveSerials(
                req.tenantId as any,
                line.product,
                line.variant,
                line.serialNumbers || [],
                `Bill ${bill.billNumber}`
            );
            if (line.batchNumber) {
                // The same batch number bought again just adds to that batch.
                await InventoryBatch.findOneAndUpdate(
                    {
                        storeId: req.tenantId,
                        product: line.product,
                        variant: line.variant || null,
                        batchNumber: line.batchNumber,
                    },
                    {
                        $inc: { initialQuantity: line.quantity, currentQuantity: line.quantity },
                        $setOnInsert: { costPrice: line.rate },
                        $set: {
                            supplier,
                            ...(line.mfgDate ? { manufacturingDate: line.mfgDate } : {}),
                            ...(line.expiryDate ? { expiryDate: line.expiryDate } : {}),
                            status: 'Active',
                        },
                    },
                    { upsert: true }
                );
            }
            await recordStockMovement({
                storeId: req.tenantId as any,
                product: line.product,
                variant: line.variant,
                type: 'PURCHASE',
                quantity: line.quantity,
                reference: `Bill ${bill.billNumber}`,
                referenceId: bill._id as any,
                userId: req.user?._id,
            });

            const product = await Product.findOne({ _id: line.product, storeId: req.tenantId }).select('costPrice');
            if (line.variant) {
                await ProductVariant.findByIdAndUpdate(line.variant, { $set: { costPrice: line.rate } });
            }
            await Product.updateOne(
                { _id: line.product, storeId: req.tenantId },
                {
                    $set: {
                        ...(line.variant ? {} : { costPrice: line.rate }),
                        lastPurchasePrice: line.rate,
                        lastPurchaseDate: bill.billDate,
                        lastSupplier: supplier,
                    },
                }
            );
            if (!line.variant) {
                await recordPriceChange({
                    storeId: req.tenantId as any,
                    product: line.product,
                    field: 'costPrice',
                    oldValue: product?.costPrice,
                    newValue: line.rate,
                    source: 'Purchase',
                    note: `Bill ${bill.billNumber} · ${supplierDoc.name}`,
                    userId: req.user?._id,
                });
            }
            const inv = await Inventory.findOne(inventoryFilter(req.tenantId as any, line.product, line.variant));
            emitToStore(req.tenantId!.toString(), 'inventory-update', {
                productId: line.product,
                variantId: line.variant,
                newQuantity: inv?.quantity,
            });
        }
        await bumpCacheVersion(req.tenantId!.toString());
    }

    res.status(201).json(new ApiResponse(201, bill, 'Purchase bill saved'));
});

// @desc    List purchase bills
// @route   GET /api/purchase-bills
export const getPurchaseBills = asyncHandler(async (req: TenantRequest, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const query: any = { storeId: req.tenantId };
    if (req.query.supplier) query.supplier = req.query.supplier;
    if (req.query.search) query.billNumber = { $regex: String(req.query.search).trim(), $options: 'i' };
    if (req.query.from || req.query.to) {
        query.billDate = {};
        if (req.query.from) query.billDate.$gte = new Date(String(req.query.from));
        if (req.query.to) query.billDate.$lte = new Date(String(req.query.to));
    }
    const [bills, total] = await Promise.all([
        PurchaseBill.find(query)
            .populate('supplier', 'name gstin')
            .sort({ billDate: -1, createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
        PurchaseBill.countDocuments(query),
    ]);
    res.status(200).json(
        new ApiResponse(200, { bills, pagination: { total, page, limit, pages: Math.ceil(total / limit) } })
    );
});

// @desc    One purchase bill
// @route   GET /api/purchase-bills/:id
export const getPurchaseBillById = asyncHandler(async (req: TenantRequest, res: Response) => {
    const bill = await PurchaseBill.findOne({ _id: req.params.id, storeId: req.tenantId }).populate(
        'supplier',
        'name gstin phone address'
    );
    if (!bill) return res.status(404).json(new ApiResponse(404, null, 'Purchase bill not found'));
    res.status(200).json(new ApiResponse(200, bill));
});

// @desc    Input tax credit summary: GST paid on purchases minus GST on returns to suppliers, per month
// @route   GET /api/purchase-bills/summary
export const getInputTaxSummary = asyncHandler(async (req: TenantRequest, res: Response) => {
    const storeId = new mongoose.Types.ObjectId(String(req.tenantId));
    const dateFilter = (field: string) => {
        const f: any = {};
        if (req.query.from) f.$gte = new Date(String(req.query.from));
        if (req.query.to) f.$lte = new Date(String(req.query.to));
        return Object.keys(f).length ? { [field]: f } : {};
    };

    const [bills, returns] = await Promise.all([
        PurchaseBill.aggregate([
            { $match: { storeId, ...dateFilter('billDate') } },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m', date: '$billDate' } },
                    taxable: { $sum: '$taxableTotal' },
                    cgst: { $sum: '$cgstTotal' },
                    sgst: { $sum: '$sgstTotal' },
                    igst: { $sum: '$igstTotal' },
                    bills: { $sum: 1 },
                },
            },
        ]),
        PurchaseReturn.aggregate([
            { $match: { storeId, ...dateFilter('createdAt') } },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
                    taxable: { $sum: '$taxableTotal' },
                    tax: { $sum: '$taxTotal' },
                },
            },
        ]),
    ]);

    const months = new Map<string, any>();
    const row = (m: string) => {
        if (!months.has(m)) {
            months.set(m, { month: m, bills: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, returnedTax: 0 });
        }
        return months.get(m);
    };
    for (const b of bills)
        Object.assign(row(b._id), { bills: b.bills, taxable: b.taxable, cgst: b.cgst, sgst: b.sgst, igst: b.igst });
    for (const r of returns) row(r._id).returnedTax = r.tax;

    const rows = [...months.values()]
        .map((r) => ({ ...r, itc: round2(r.cgst + r.sgst + r.igst - r.returnedTax) }))
        .sort((a, b) => b.month.localeCompare(a.month));
    const totals = rows.reduce(
        (t, r) => ({
            taxable: round2(t.taxable + r.taxable),
            cgst: round2(t.cgst + r.cgst),
            sgst: round2(t.sgst + r.sgst),
            igst: round2(t.igst + r.igst),
            returnedTax: round2(t.returnedTax + r.returnedTax),
            itc: round2(t.itc + r.itc),
        }),
        { taxable: 0, cgst: 0, sgst: 0, igst: 0, returnedTax: 0, itc: 0 }
    );
    res.status(200).json(new ApiResponse(200, { rows, totals }));
});

// ── Purchase returns (debit notes) ──

// @desc    Send goods back to a supplier — reduces stock and creates a debit note
// @route   POST /api/purchase-returns
export const createPurchaseReturn = asyncHandler(async (req: TenantRequest, res: Response) => {
    const { supplier, purchaseBill, items, reason } = req.body;
    if (!supplier) return res.status(400).json(new ApiResponse(400, null, 'Select the supplier.'));
    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json(new ApiResponse(400, null, 'Add at least one product to return.'));
    }
    const supplierDoc = await Supplier.findOne({ _id: supplier, storeId: req.tenantId });
    if (!supplierDoc) return res.status(404).json(new ApiResponse(404, null, 'Supplier not found'));

    const isInterState = req.body.isInterState === true;
    let lines;
    try {
        lines = await buildLines(req.tenantId, items, isInterState);
    } catch (e: any) {
        return res.status(400).json(new ApiResponse(400, null, e.message));
    }

    // You cannot send back more than you have.
    for (const line of lines) {
        const inv = await Inventory.findOne(inventoryFilter(req.tenantId as any, line.product, line.variant));
        if ((inv?.quantity ?? 0) < line.quantity) {
            return res
                .status(400)
                .json(
                    new ApiResponse(
                        400,
                        null,
                        `Only ${inv?.quantity ?? 0} of "${line.name}" in stock - cannot return ${line.quantity}.`
                    )
                );
        }
    }

    const totals = sumLines(lines);
    const debitNoteNumber = `DN-${Date.now()}`;
    const ret = await PurchaseReturn.create({
        storeId: req.tenantId,
        debitNoteNumber,
        supplier,
        purchaseBill: purchaseBill || undefined,
        isInterState,
        items: lines,
        taxableTotal: totals.taxableTotal,
        taxTotal: totals.taxTotal,
        grandTotal: totals.grandTotal,
        reason,
        createdBy: req.user?._id,
    });

    for (const line of lines) {
        const inv = await Inventory.findOneAndUpdate(
            inventoryFilter(req.tenantId as any, line.product, line.variant),
            { $inc: { quantity: -line.quantity }, $set: { lastStockUpdate: new Date() } },
            { new: true }
        );
        await recordStockMovement({
            storeId: req.tenantId as any,
            product: line.product,
            variant: line.variant,
            type: 'PURCHASE_RETURN',
            quantity: -line.quantity,
            reference: debitNoteNumber,
            referenceId: ret._id as any,
            notes: reason,
            userId: req.user?._id,
        });
        emitToStore(req.tenantId!.toString(), 'inventory-update', {
            productId: line.product,
            variantId: line.variant,
            newQuantity: inv?.quantity,
        });
    }
    await bumpCacheVersion(req.tenantId!.toString());

    res.status(201).json(new ApiResponse(201, ret, 'Purchase return saved'));
});

// @desc    List purchase returns
// @route   GET /api/purchase-returns
export const getPurchaseReturns = asyncHandler(async (req: TenantRequest, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const query: any = { storeId: req.tenantId };
    if (req.query.supplier) query.supplier = req.query.supplier;
    const [returns, total] = await Promise.all([
        PurchaseReturn.find(query)
            .populate('supplier', 'name')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
        PurchaseReturn.countDocuments(query),
    ]);
    res.status(200).json(
        new ApiResponse(200, { returns, pagination: { total, page, limit, pages: Math.ceil(total / limit) } })
    );
});

// @desc    One purchase return (the debit note)
// @route   GET /api/purchase-returns/:id
export const getPurchaseReturnById = asyncHandler(async (req: TenantRequest, res: Response) => {
    const ret = await PurchaseReturn.findOne({ _id: req.params.id, storeId: req.tenantId }).populate(
        'supplier',
        'name gstin phone address'
    );
    if (!ret) return res.status(404).json(new ApiResponse(404, null, 'Purchase return not found'));
    res.status(200).json(new ApiResponse(200, ret));
});
