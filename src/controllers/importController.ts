import { Response } from 'express';
import Product from '../models/Product.js';
import Inventory from '../models/Inventory.js';
import { TenantRequest } from '../middleware/tenantHandler.js';
import ApiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import mongoose from 'mongoose';
import ExcelJS from 'exceljs';
import Category from '../models/Category.js';
import { PassThrough } from 'stream';

export const importController = {
    // @desc    Import products from Excel/CSV file
    // @route   POST /api/import/products
    importProducts: asyncHandler(async (req: TenantRequest, res: Response) => {
        if (!req.file) {
            return res.status(400).json(new ApiResponse(400, null, "No file uploaded"));
        }

        const workbook = new ExcelJS.Workbook();
        const buffer = req.file.buffer;

        // Support both .xlsx and .csv
        if (req.file.originalname.toLowerCase().endsWith('.csv')) {
            const stream = new PassThrough();
            stream.end(buffer);
            await workbook.csv.read(stream as any);
        } else {
            await workbook.xlsx.load(buffer as any);
        }

        const worksheet = workbook.getWorksheet(1);
        if (!worksheet) return res.status(400).json(new ApiResponse(400, null, "Invalid worksheet"));

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
                        category = await Category.create([{ name: catName, storeId }], { session }).then(docs => docs[0]);
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
                        hasVariants: false
                    });
                    await product.save({ session });

                    const inventory = new Inventory({
                        product: product._id,
                        store: storeId,
                        quantity: initialStock
                    });
                    await inventory.save({ session });

                    importedProducts.push(product);
                } catch (err: any) {
                    errors.push({ row: i, error: err.message });
                }
            }

            await session.commitTransaction();
            res.status(201).json(new ApiResponse(201, {
                count: importedProducts.length,
                errors: errors.length > 0 ? errors : undefined
            }, `Imported ${importedProducts.length} products successfully`));
        } catch (error: any) {
            await session.abortTransaction();
            res.status(500).json(new ApiResponse(500, null, error.message));
        } finally {
            session.endSession();
        }
    })
};
