import { Response } from 'express';
import Product from '../models/Product.js';
import Inventory from '../models/Inventory.js';
import Customer from '../models/Customer.js';
import Supplier from '../models/Supplier.js';
import { TenantRequest } from '../middleware/tenantHandler.js';
import ApiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import mongoose from 'mongoose';
import ExcelJS from 'exceljs';
import Category from '../models/Category.js';
import { PassThrough } from 'stream';

// Shared by importCustomers/importSuppliers/importProducts — same "positional
// columns, skip header row, .xlsx or .csv" contract for all three.
async function loadWorksheet(file: Express.Multer.File) {
    const workbook = new ExcelJS.Workbook();
    if (file.originalname.toLowerCase().endsWith('.csv')) {
        const stream = new PassThrough();
        stream.end(file.buffer);
        await workbook.csv.read(stream as any);
    } else {
        await workbook.xlsx.load(file.buffer as any);
    }
    return workbook.getWorksheet(1);
}

export const importController = {
    // @desc    Import products from Excel/CSV file
    // @route   POST /api/import/products
    importProducts: asyncHandler(async (req: TenantRequest, res: Response) => {
        if (!req.file) {
            return res.status(400).json(new ApiResponse(400, null, 'No file uploaded'));
        }

        const worksheet = await loadWorksheet(req.file);
        if (!worksheet) return res.status(400).json(new ApiResponse(400, null, 'Invalid worksheet'));

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const storeId = req.tenantId;
            const importedProducts = [];
            const errors = [];

            // Iterate through rows (skipping header)
            for (let i = 2; i <= worksheet.rowCount; i++) {
                const row = worksheet.getRow(i);
                if (!row.getCell(1).value) continue; // Skip empty rows

                try {
                    const name = row.getCell(1).text;
                    const sku = row.getCell(2).text;
                    const barcode = row.getCell(3).text;
                    const catName = row.getCell(4).text;
                    const price = parseFloat(row.getCell(5).text) || 0;
                    const costPrice = parseFloat(row.getCell(6).text) || 0;
                    const taxRate = parseFloat(row.getCell(7).text) || 0;
                    const initialStock = parseFloat(row.getCell(8).text) || 0;

                    // Find or create category
                    let category = await Category.findOne({ name: catName, storeId });
                    if (!category) {
                        category = await Category.create([{ name: catName, storeId }], { session }).then(
                            (docs) => docs[0]
                        );
                    }

                    const product = new Product({
                        name,
                        sku,
                        barcode,
                        category: category?._id,
                        price,
                        costPrice,
                        taxRate,
                        storeId,
                        hasVariants: false,
                    });
                    await product.save({ session });

                    const inventory = new Inventory({
                        product: product._id,
                        store: storeId,
                        quantity: initialStock,
                    });
                    await inventory.save({ session });

                    importedProducts.push(product);
                } catch (err: any) {
                    errors.push({ row: i, error: err.message });
                }
            }

            await session.commitTransaction();
            res.status(201).json(
                new ApiResponse(
                    201,
                    {
                        count: importedProducts.length,
                        errors: errors.length > 0 ? errors : undefined,
                    },
                    `Imported ${importedProducts.length} products successfully`
                )
            );
        } catch (error: any) {
            await session.abortTransaction();
            res.status(500).json(new ApiResponse(500, null, error.message));
        } finally {
            session.endSession();
        }
    }),

    // @desc    Import customers from Excel/CSV file
    // @route   POST /api/import/customers
    // Columns: Name, Phone, Email, Address, GSTIN, Segment (Retail/Wholesale/VIP)
    importCustomers: asyncHandler(async (req: TenantRequest, res: Response) => {
        if (!req.file) {
            return res.status(400).json(new ApiResponse(400, null, 'No file uploaded'));
        }
        const worksheet = await loadWorksheet(req.file);
        if (!worksheet) return res.status(400).json(new ApiResponse(400, null, 'Invalid worksheet'));

        const storeId = req.tenantId;
        const imported: any[] = [];
        const errors: { row: number; error: string }[] = [];
        const validSegments = ['Retail', 'Wholesale', 'VIP'];

        for (let i = 2; i <= worksheet.rowCount; i++) {
            const row = worksheet.getRow(i);
            if (!row.getCell(1).value) continue;

            try {
                const name = row.getCell(1).text;
                const phone = row.getCell(2).text;
                if (!name || !phone) throw new Error('Name and Phone are required');

                const email = row.getCell(3).text || undefined;
                const address = row.getCell(4).text || undefined;
                const gstin = row.getCell(5).text || undefined;
                const segmentRaw = row.getCell(6).text;
                const segment = validSegments.includes(segmentRaw) ? segmentRaw : 'Retail';

                const customer = await Customer.create({ name, phone, email, address, gstin, segment, storeId });
                imported.push(customer);
            } catch (err: any) {
                errors.push({ row: i, error: err.message });
            }
        }

        res.status(201).json(
            new ApiResponse(
                201,
                { count: imported.length, errors: errors.length > 0 ? errors : undefined },
                `Imported ${imported.length} customers successfully`
            )
        );
    }),

    // @desc    Import suppliers from Excel/CSV file
    // @route   POST /api/import/suppliers
    // Columns: Name, Contact Person, Phone, Email, Address
    importSuppliers: asyncHandler(async (req: TenantRequest, res: Response) => {
        if (!req.file) {
            return res.status(400).json(new ApiResponse(400, null, 'No file uploaded'));
        }
        const worksheet = await loadWorksheet(req.file);
        if (!worksheet) return res.status(400).json(new ApiResponse(400, null, 'Invalid worksheet'));

        const storeId = req.tenantId;
        const imported: any[] = [];
        const errors: { row: number; error: string }[] = [];

        for (let i = 2; i <= worksheet.rowCount; i++) {
            const row = worksheet.getRow(i);
            if (!row.getCell(1).value) continue;

            try {
                const name = row.getCell(1).text;
                const contactPerson = row.getCell(2).text || undefined;
                const phone = row.getCell(3).text;
                if (!name || !phone) throw new Error('Name and Phone are required');

                const email = row.getCell(4).text || undefined;
                const address = row.getCell(5).text || undefined;

                const supplier = await Supplier.create({ name, contactPerson, phone, email, address, storeId });
                imported.push(supplier);
            } catch (err: any) {
                errors.push({ row: i, error: err.message });
            }
        }

        res.status(201).json(
            new ApiResponse(
                201,
                { count: imported.length, errors: errors.length > 0 ? errors : undefined },
                `Imported ${imported.length} suppliers successfully`
            )
        );
    }),
};
