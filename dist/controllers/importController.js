import Product from '../models/Product.js';
import Inventory from '../models/Inventory.js';
import Customer from '../models/Customer.js';
import Supplier from '../models/Supplier.js';
import ApiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import mongoose from 'mongoose';
import ExcelJS from 'exceljs';
import Category from '../models/Category.js';
import { PassThrough } from 'stream';
import { customAlphabet } from 'nanoid';
import Store from '../models/Store.js';
import Brand from '../models/Brand.js';
import InventoryBatch from '../models/InventoryBatch.js';
import { bumpCacheVersion } from '../config/redis.js';
import { isTenantApproved, isTrialTenant, TRIAL_PRODUCT_LIMIT } from '../middleware/usageLimits.js';
import { UNIT_CODES } from '../utils/units.js';
import { inventoryFilter, recordPriceChange, recordStockMovement } from '../utils/stockMovement.js';
// Shared by importCustomers/importSuppliers/importProducts — same "positional
// columns, skip header row, .xlsx or .csv" contract for all three.
async function loadWorksheet(file) {
    const workbook = new ExcelJS.Workbook();
    if (file.originalname.toLowerCase().endsWith('.csv')) {
        const stream = new PassThrough();
        stream.end(file.buffer);
        await workbook.csv.read(stream);
    }
    else {
        await workbook.xlsx.load(file.buffer);
    }
    return workbook.getWorksheet(1);
}
export const importController = {
    // @desc    Import products from Excel/CSV file — creates new products and (optionally) updates existing ones
    //          Columns are found by their heading, so the order does not matter; a file without headings is read
    //          in the old order (Name, SKU, Barcode, Category, Price, Cost Price, Tax Rate, Stock).
    //          Body field `updateExisting=true` updates products that already exist (matched by barcode or SKU).
    // @route   POST /api/import/products
    importProducts: asyncHandler(async (req, res) => {
        if (!req.file) {
            return res.status(400).json(new ApiResponse(400, null, 'No file uploaded'));
        }
        const worksheet = await loadWorksheet(req.file);
        if (!worksheet)
            return res.status(400).json(new ApiResponse(400, null, 'Invalid worksheet'));
        const storeId = req.tenantId;
        const updateExisting = String(req.body?.updateExisting) === 'true';
        // Which column holds what.
        const norm = (v) => v.toLowerCase().replace(/[^a-z0-9]/g, '');
        const aliases = {
            name: ['name', 'productname', 'product'],
            sku: ['sku'],
            barcode: ['barcode'],
            category: ['category'],
            subCategory: ['subcategory'],
            brand: ['brand'],
            unit: ['unit', 'uom', 'unitofmeasure'],
            price: ['price', 'sellingprice', 'saleprice'],
            mrp: ['mrp'],
            costPrice: ['costprice', 'cost', 'purchaseprice'],
            taxRate: ['taxrate', 'tax', 'gst', 'gstrate'],
            hsnCode: ['hsn', 'hsncode', 'hsnsac'],
            stock: ['stock', 'initialstock', 'openingstock', 'quantity', 'qty'],
            reorderLevel: ['reorderlevel', 'minstock', 'lowstock'],
            location: ['location', 'rack', 'shelf', 'bin'],
            batchNumber: ['batch', 'batchno', 'batchnumber'],
            mfgDate: ['mfgdate', 'manufacturingdate', 'mfg'],
            expiryDate: ['expiry', 'expirydate', 'expdate', 'exp'],
            description: ['description'],
            active: ['active', 'isactive'],
        };
        const headerRow = worksheet.getRow(1);
        const col = {};
        headerRow.eachCell((cell, n) => {
            const key = norm(cell.text || '');
            for (const [field, names] of Object.entries(aliases)) {
                if (names.includes(key) && !col[field])
                    col[field] = n;
            }
        });
        if (!col.name) {
            // No headings we recognise: the original fixed order.
            Object.assign(col, {
                name: 1,
                sku: 2,
                barcode: 3,
                category: 4,
                price: 5,
                costPrice: 6,
                taxRate: 7,
                stock: 8,
            });
        }
        const get = (row, field) => col[field] ? row.getCell(col[field]).text.trim() : '';
        const num = (v) => {
            if (v === '')
                return undefined;
            const n = parseFloat(v);
            if (!Number.isFinite(n))
                throw new Error(`"${v}" is not a number`);
            return n;
        };
        const date = (v) => {
            if (!v)
                return undefined;
            const d = new Date(v);
            if (isNaN(d.getTime()))
                throw new Error(`"${v}" is not a valid date (use YYYY-MM-DD)`);
            return d;
        };
        // Plan limit on how many products the store may hold.
        const store = await Store.findById(storeId).populate('subscriptionPlan');
        let limit = 0;
        if (store && isTrialTenant(store))
            limit = TRIAL_PRODUCT_LIMIT;
        else if (store && store.subscriptionPlan && !isTenantApproved(store)) {
            limit = store.subscriptionPlan.maxProducts || 0;
        }
        let productCount = limit ? await Product.countDocuments({ storeId }) : 0;
        const nameKey = (n) => n.trim().toLowerCase();
        const categoryCache = new Map();
        const findOrCreateCategory = async (name, parentId) => {
            const key = `${parentId || ''}|${nameKey(name)}`;
            if (categoryCache.has(key))
                return categoryCache.get(key);
            const filter = {
                storeId,
                name: new RegExp(`^${name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
            };
            filter.parentId = parentId || { $in: [null, undefined] };
            let cat = await Category.findOne(filter);
            if (!cat)
                cat = await Category.create({ name: name.trim(), storeId, ...(parentId ? { parentId } : {}) });
            categoryCache.set(key, cat);
            return cat;
        };
        const brandCache = new Map();
        const findOrCreateBrand = async (name) => {
            const key = nameKey(name);
            if (brandCache.has(key))
                return brandCache.get(key);
            let brand = await Brand.findOne({
                storeId,
                name: new RegExp(`^${name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
            });
            if (!brand)
                brand = await Brand.create({ name: name.trim(), storeId });
            brandCache.set(key, brand);
            return brand;
        };
        const generateBarcode = customAlphabet('0123456789', 12);
        let created = 0;
        let updated = 0;
        const errors = [];
        for (let i = 2; i <= worksheet.rowCount; i++) {
            const row = worksheet.getRow(i);
            const name = get(row, 'name');
            if (!name) {
                if (row.hasValues)
                    errors.push({ row: i, error: 'Product name is missing' });
                continue;
            }
            try {
                const sku = get(row, 'sku');
                const barcode = get(row, 'barcode');
                const price = num(get(row, 'price'));
                const mrp = num(get(row, 'mrp'));
                const costPrice = num(get(row, 'costPrice'));
                const taxRate = num(get(row, 'taxRate'));
                const stock = num(get(row, 'stock'));
                const reorderLevel = num(get(row, 'reorderLevel'));
                const mfgDate = date(get(row, 'mfgDate'));
                const expiryDate = date(get(row, 'expiryDate'));
                const batchNumber = get(row, 'batchNumber');
                const unitRaw = get(row, 'unit').toLowerCase();
                if (unitRaw && !UNIT_CODES.includes(unitRaw)) {
                    throw new Error(`Unit "${unitRaw}" is not valid (use ${UNIT_CODES.join(', ')})`);
                }
                if (batchNumber && !expiryDate)
                    throw new Error('A batch number needs an expiry date');
                if ((price !== undefined && price < 0) || (stock !== undefined && stock < 0)) {
                    throw new Error('Price and stock cannot be negative');
                }
                let existing = null;
                if (barcode || sku) {
                    existing = await Product.findOne({
                        storeId,
                        $or: [...(barcode ? [{ barcode }] : []), ...(sku ? [{ sku }] : [])],
                    });
                }
                let category;
                let subCategory;
                const catName = get(row, 'category');
                if (catName) {
                    category = await findOrCreateCategory(catName);
                    const sub = get(row, 'subCategory');
                    if (sub)
                        subCategory = await findOrCreateCategory(sub, category._id);
                }
                const brand = get(row, 'brand') ? await findOrCreateBrand(get(row, 'brand')) : undefined;
                let product;
                if (existing) {
                    if (!updateExisting) {
                        throw new Error('Already exists — tick "Update existing products" to change it');
                    }
                    const set = {};
                    if (price !== undefined)
                        set.price = price;
                    if (mrp !== undefined)
                        set.mrp = mrp;
                    if (costPrice !== undefined)
                        set.costPrice = costPrice;
                    if (taxRate !== undefined)
                        set.taxRate = taxRate;
                    if (category)
                        set.category = category._id;
                    if (subCategory)
                        set.subCategory = subCategory._id;
                    if (brand)
                        set.brand = brand._id;
                    if (unitRaw)
                        set.unit = unitRaw;
                    if (get(row, 'hsnCode'))
                        set.hsnCode = get(row, 'hsnCode');
                    if (get(row, 'location'))
                        set.location = get(row, 'location');
                    if (get(row, 'description'))
                        set.description = get(row, 'description');
                    if (batchNumber)
                        set.trackBatch = true;
                    if (get(row, 'active'))
                        set.isActive = !['no', 'false', '0', 'n'].includes(get(row, 'active').toLowerCase());
                    if (name !== existing.name)
                        set.name = name;
                    product = await Product.findOneAndUpdate({ _id: existing._id, storeId }, { $set: set }, { new: true });
                    for (const field of ['price', 'mrp', 'costPrice']) {
                        if (set[field] !== undefined) {
                            await recordPriceChange({
                                storeId,
                                product: existing._id,
                                field,
                                oldValue: existing[field],
                                newValue: set[field],
                                source: 'Import',
                                userId: req.user?._id,
                            });
                        }
                    }
                    updated++;
                }
                else {
                    if (!category)
                        throw new Error('Category is required for a new product');
                    if (price === undefined)
                        throw new Error('Price is required for a new product');
                    if (limit && productCount >= limit)
                        throw new Error(`Plan limit of ${limit} products reached`);
                    const finalBarcode = barcode || generateBarcode();
                    product = await Product.create({
                        name,
                        sku: sku || `SKU-${finalBarcode}`,
                        barcode: finalBarcode,
                        category: category._id,
                        subCategory: subCategory?._id,
                        brand: brand?._id,
                        unit: unitRaw || 'pcs',
                        price,
                        mrp,
                        costPrice: costPrice ?? 0,
                        taxRate: taxRate ?? 0,
                        hsnCode: get(row, 'hsnCode') || undefined,
                        location: get(row, 'location') || undefined,
                        description: get(row, 'description') || undefined,
                        trackBatch: !!batchNumber,
                        isActive: !['no', 'false', '0', 'n'].includes((get(row, 'active') || 'yes').toLowerCase()),
                        storeId,
                        hasVariants: false,
                    });
                    productCount++;
                    created++;
                }
                // Stock: a new product starts with this quantity; for an existing one the file sets the stock to it.
                const inventory = await Inventory.findOne(inventoryFilter(storeId, product._id));
                const previous = inventory?.quantity ?? 0;
                if (stock !== undefined || reorderLevel !== undefined || !inventory) {
                    await Inventory.findOneAndUpdate(inventoryFilter(storeId, product._id), {
                        $set: {
                            ...(stock !== undefined ? { quantity: stock, lastStockUpdate: new Date() } : {}),
                            ...(reorderLevel !== undefined ? { lowStockThreshold: reorderLevel } : {}),
                        },
                        $setOnInsert: stock === undefined ? { quantity: 0 } : {},
                    }, { upsert: true });
                }
                if (stock !== undefined && stock !== previous) {
                    await recordStockMovement({
                        storeId,
                        product: product._id,
                        type: existing ? 'ADJUSTMENT' : 'OPENING',
                        quantity: stock - previous,
                        reference: 'Import',
                        userId: req.user?._id,
                    });
                }
                if (batchNumber && expiryDate) {
                    await InventoryBatch.findOneAndUpdate({ storeId, product: product._id, variant: null, batchNumber }, {
                        $set: { expiryDate, ...(mfgDate ? { manufacturingDate: mfgDate } : {}), status: 'Active' },
                        $setOnInsert: {
                            initialQuantity: stock ?? 0,
                            currentQuantity: stock ?? 0,
                            costPrice: costPrice ?? product.costPrice ?? 0,
                        },
                    }, { upsert: true });
                }
            }
            catch (err) {
                errors.push({ row: i, name, error: err.message });
            }
        }
        await bumpCacheVersion(storeId.toString());
        res.status(200).json(new ApiResponse(200, { created, updated, count: created + updated, errors: errors.length > 0 ? errors : undefined }, `${created} created, ${updated} updated${errors.length ? `, ${errors.length} rows skipped` : ''}`));
    }),
    // @desc    Every product as an .xlsx in the import layout, with current stock and the nearest-expiry batch,
    //          so it can be edited in Excel and imported back with "Update existing products".
    // @route   GET /api/import/products/export
    exportProducts: asyncHandler(async (req, res) => {
        const storeId = new mongoose.Types.ObjectId(String(req.tenantId));
        const products = await Product.find({ storeId })
            .populate('category', 'name')
            .populate('subCategory', 'name')
            .populate('brand', 'name')
            .sort({ name: 1 })
            .lean();
        const inventories = await Inventory.find({ store: storeId, variant: { $exists: false } }).lean();
        const stockOf = new Map(inventories.map((i) => [i.product.toString(), i]));
        const batches = await InventoryBatch.aggregate([
            { $match: { storeId, status: 'Active', currentQuantity: { $gt: 0 }, variant: null } },
            { $sort: { expiryDate: 1 } },
            {
                $group: {
                    _id: '$product',
                    batchNumber: { $first: '$batchNumber' },
                    expiryDate: { $first: '$expiryDate' },
                    manufacturingDate: { $first: '$manufacturingDate' },
                },
            },
        ]);
        const batchOf = new Map(batches.map((b) => [b._id.toString(), b]));
        const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Products');
        sheet.columns = [
            { header: 'Name', key: 'name', width: 28 },
            { header: 'SKU', key: 'sku', width: 14 },
            { header: 'Barcode', key: 'barcode', width: 16 },
            { header: 'Category', key: 'category', width: 16 },
            { header: 'Sub Category', key: 'subCategory', width: 16 },
            { header: 'Brand', key: 'brand', width: 14 },
            { header: 'Unit', key: 'unit', width: 8 },
            { header: 'Price', key: 'price', width: 10 },
            { header: 'MRP', key: 'mrp', width: 10 },
            { header: 'Cost Price', key: 'costPrice', width: 11 },
            { header: 'Tax Rate', key: 'taxRate', width: 9 },
            { header: 'HSN', key: 'hsn', width: 10 },
            { header: 'Stock', key: 'stock', width: 9 },
            { header: 'Reorder Level', key: 'reorderLevel', width: 14 },
            { header: 'Location', key: 'location', width: 12 },
            { header: 'Batch No', key: 'batch', width: 12 },
            { header: 'Mfg Date', key: 'mfg', width: 12 },
            { header: 'Expiry Date', key: 'expiry', width: 12 },
            { header: 'Active', key: 'active', width: 8 },
        ];
        sheet.getRow(1).font = { bold: true };
        for (const p of products) {
            const inv = stockOf.get(p._id.toString());
            const b = batchOf.get(p._id.toString());
            sheet.addRow({
                name: p.name,
                sku: p.sku,
                barcode: p.barcode,
                category: p.category?.name || '',
                subCategory: p.subCategory?.name || '',
                brand: p.brand?.name || '',
                unit: p.unit || 'pcs',
                price: p.price,
                mrp: p.mrp ?? '',
                costPrice: p.costPrice ?? '',
                taxRate: p.taxRate ?? 0,
                hsn: p.hsnCode || '',
                stock: p.isCombo ? '' : (inv?.quantity ?? 0),
                reorderLevel: inv?.lowStockThreshold ?? '',
                location: p.location || '',
                batch: b?.batchNumber || '',
                mfg: day(b?.manufacturingDate),
                expiry: day(b?.expiryDate),
                active: p.isActive === false ? 'No' : 'Yes',
            });
        }
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="products-export.xlsx"');
        await workbook.xlsx.write(res);
        res.end();
    }),
    // @desc    A ready-to-fill product import file (.xlsx) with every supported column and example rows
    // @route   GET /api/import/products/sample
    downloadProductSample: asyncHandler(async (_req, res) => {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Products');
        sheet.columns = [
            { header: 'Name', key: 'name', width: 28 },
            { header: 'SKU', key: 'sku', width: 14 },
            { header: 'Barcode', key: 'barcode', width: 16 },
            { header: 'Category', key: 'category', width: 16 },
            { header: 'Sub Category', key: 'subCategory', width: 16 },
            { header: 'Brand', key: 'brand', width: 14 },
            { header: 'Unit', key: 'unit', width: 8 },
            { header: 'Price', key: 'price', width: 10 },
            { header: 'MRP', key: 'mrp', width: 10 },
            { header: 'Cost Price', key: 'costPrice', width: 11 },
            { header: 'Tax Rate', key: 'taxRate', width: 9 },
            { header: 'HSN', key: 'hsn', width: 10 },
            { header: 'Stock', key: 'stock', width: 9 },
            { header: 'Reorder Level', key: 'reorderLevel', width: 14 },
            { header: 'Location', key: 'location', width: 12 },
            { header: 'Batch No', key: 'batch', width: 12 },
            { header: 'Mfg Date', key: 'mfg', width: 12 },
            { header: 'Expiry Date', key: 'expiry', width: 12 },
        ];
        sheet.getRow(1).font = { bold: true };
        sheet.addRow({
            name: 'Basmati Rice',
            sku: 'RICE-01',
            barcode: '8901234500011',
            category: 'Grocery',
            subCategory: 'Rice',
            brand: 'India Gate',
            unit: 'kg',
            price: 95,
            mrp: 110,
            costPrice: 78,
            taxRate: 5,
            hsn: '1006',
            stock: 120,
            reorderLevel: 20,
            location: 'A-3',
        });
        sheet.addRow({
            name: 'Paracetamol 500mg',
            sku: 'MED-01',
            barcode: '8901234500028',
            category: 'Medicine',
            unit: 'pack',
            price: 28,
            mrp: 32,
            costPrice: 20,
            taxRate: 12,
            hsn: '3004',
            stock: 60,
            reorderLevel: 10,
            location: 'B-1',
            batch: 'B2401',
            mfg: '2026-01-15',
            expiry: '2028-01-14',
        });
        const notes = workbook.addWorksheet('Read me');
        [
            'Name is required. For a NEW product Category and Price are also required.',
            'Unit: pcs, box, pack, dozen, pair, set, kg, g, l, ml, m, cm, ft, sqft (default pcs).',
            'Existing products are matched by Barcode or SKU. They are only changed if you tick "Update existing products".',
            'Stock: a new product starts with this quantity. For an existing product it SETS the stock to this number.',
            'Batch No + Expiry Date (YYYY-MM-DD) create a batch and switch on expiry tracking for that product.',
            'Empty cells are ignored when updating, so you can include only the columns you want to change.',
        ].forEach((t) => notes.addRow([t]));
        notes.getColumn(1).width = 120;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="product-import-sample.xlsx"');
        await workbook.xlsx.write(res);
        res.end();
    }),
    // @desc    Import customers from Excel/CSV file
    // @route   POST /api/import/customers
    // Columns: Name, Phone, Email, Address, GSTIN, Segment (Retail/Wholesale/VIP)
    importCustomers: asyncHandler(async (req, res) => {
        if (!req.file) {
            return res.status(400).json(new ApiResponse(400, null, 'No file uploaded'));
        }
        const worksheet = await loadWorksheet(req.file);
        if (!worksheet)
            return res.status(400).json(new ApiResponse(400, null, 'Invalid worksheet'));
        const storeId = req.tenantId;
        const imported = [];
        const errors = [];
        const validSegments = ['Retail', 'Wholesale', 'VIP'];
        for (let i = 2; i <= worksheet.rowCount; i++) {
            const row = worksheet.getRow(i);
            if (!row.getCell(1).value)
                continue;
            try {
                const name = row.getCell(1).text;
                const phone = row.getCell(2).text;
                if (!name || !phone)
                    throw new Error('Name and Phone are required');
                const email = row.getCell(3).text || undefined;
                const address = row.getCell(4).text || undefined;
                const gstin = row.getCell(5).text || undefined;
                const segmentRaw = row.getCell(6).text;
                const segment = validSegments.includes(segmentRaw) ? segmentRaw : 'Retail';
                const customer = await Customer.create({ name, phone, email, address, gstin, segment, storeId });
                imported.push(customer);
            }
            catch (err) {
                errors.push({ row: i, error: err.message });
            }
        }
        res.status(201).json(new ApiResponse(201, { count: imported.length, errors: errors.length > 0 ? errors : undefined }, `Imported ${imported.length} customers successfully`));
    }),
    // @desc    Import suppliers from Excel/CSV file
    // @route   POST /api/import/suppliers
    // Columns: Name, Contact Person, Phone, Email, Address
    importSuppliers: asyncHandler(async (req, res) => {
        if (!req.file) {
            return res.status(400).json(new ApiResponse(400, null, 'No file uploaded'));
        }
        const worksheet = await loadWorksheet(req.file);
        if (!worksheet)
            return res.status(400).json(new ApiResponse(400, null, 'Invalid worksheet'));
        const storeId = req.tenantId;
        const imported = [];
        const errors = [];
        for (let i = 2; i <= worksheet.rowCount; i++) {
            const row = worksheet.getRow(i);
            if (!row.getCell(1).value)
                continue;
            try {
                const name = row.getCell(1).text;
                const contactPerson = row.getCell(2).text || undefined;
                const phone = row.getCell(3).text;
                if (!name || !phone)
                    throw new Error('Name and Phone are required');
                const email = row.getCell(4).text || undefined;
                const address = row.getCell(5).text || undefined;
                const supplier = await Supplier.create({ name, contactPerson, phone, email, address, storeId });
                imported.push(supplier);
            }
            catch (err) {
                errors.push({ row: i, error: err.message });
            }
        }
        res.status(201).json(new ApiResponse(201, { count: imported.length, errors: errors.length > 0 ? errors : undefined }, `Imported ${imported.length} suppliers successfully`));
    }),
};
