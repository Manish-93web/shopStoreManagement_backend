import { Response } from 'express';
import PaymentTransaction from '../models/PaymentTransaction.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/apiResponse.js';
import { TenantRequest } from '../middleware/tenantHandler.js';
import ExcelJS from 'exceljs';
import dayjs from 'dayjs';

// @desc    Get General Ledger (Financial Inflows/Outflows)
// @route   GET /api/v1/accounting/ledger
export const getGeneralLedger = asyncHandler(async (req: TenantRequest, res: Response) => {
    const { startDate, endDate, transactionType } = req.query;
    const query: any = { storeId: req.tenantId };

    if (startDate && endDate) {
        query.createdAt = {
            $gte: dayjs(startDate as string).startOf('day').toDate(),
            $lte: dayjs(endDate as string).endOf('day').toDate()
        };
    }

    if (transactionType && transactionType !== 'All') {
        query.type = transactionType;
    }

    const transactions = await PaymentTransaction.find(query)
        .populate('performedBy', 'name')
        .sort({ sxAt: -1, createdAt: -1 });

    // Calculate Summary
    const summary = transactions.reduce((acc, tx) => {
        if (tx.type === 'Inflow') acc.totalInflow += tx.amount;
        else acc.totalOutflow += tx.amount;
        return acc;
    }, { totalInflow: 0, totalOutflow: 0 });

    res.status(200).json(new ApiResponse(200, {
        transactions,
        summary,
        netBalance: summary.totalInflow - summary.totalOutflow
    }));
});

// @desc    Export Accounting CSV (Tally/ERP Compatible)
// @route   GET /api/v1/accounting/export
export const exportAccountingData = asyncHandler(async (req: TenantRequest, res: Response) => {
    const transactions = await PaymentTransaction.find({ storeId: req.tenantId }).sort({ createdAt: 1 });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('General Ledger');

    worksheet.columns = [
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Transaction ID', key: 'id', width: 25 },
        { header: 'Particulars', key: 'particulars', width: 40 },
        { header: 'Voucher Type', key: 'voucherType', width: 15 },
        { header: 'Credit (Inflow)', key: 'credit', width: 15 },
        { header: 'Debit (Outflow)', key: 'debit', width: 15 },
        { header: 'Balance', key: 'balance', width: 15 }
    ];

    let runningBalance = 0;
    transactions.forEach(tx => {
        const isCredit = tx.type === 'Inflow';
        const amount = tx.amount;
        runningBalance += isCredit ? amount : -amount;

        worksheet.addRow({
            date: dayjs(tx.createdAt).format('YYYY-MM-DD HH:mm'),
            id: tx.transactionNumber,
            particulars: tx.notes || `${tx.category} via ${tx.method}`,
            voucherType: tx.category,
            credit: isCredit ? amount : 0,
            debit: !isCredit ? amount : 0,
            balance: runningBalance
        });
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=accounting_export_${dayjs().format('YYYY-MM-DD')}.csv`);

    await workbook.csv.write(res);
});
