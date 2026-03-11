import { Worker, Job } from 'bullmq';
import Order from '../models/Order.js';
import Inventory from '../models/Inventory.js';
import Report from '../models/Report.js';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

const connection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379')
};

let reportWorker: Worker | null = null;

if (process.env.SKIP_REDIS !== 'true') {
    reportWorker = new Worker('report-generation', async (job: Job) => {
        const { tenantId, type, filters, format, userId } = job.data;
        console.log(`Working on report job: ${job.id} for tenant: ${tenantId}`);

        // Update report status to processing
        const reportRecord = await Report.create({
            storeId: tenantId,
            type,
            status: 'processing',
            format,
            filters,
            generatedBy: userId
        });

        try {
            const fileName = `report-${type}-${Date.now()}.${format}`;
            const publicDir = path.join(process.cwd(), 'public', 'reports');
            if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
            const filePath = path.join(publicDir, fileName);

            if (format === 'excel' || format === 'csv') {
                const workbook = new ExcelJS.Workbook();
                const worksheet = workbook.addWorksheet('Report');

                if (type === 'sales') {
                    const orders = await Order.find({ storeId: tenantId, status: 'Completed' });
                    worksheet.columns = [
                        { header: 'Order #', key: 'orderNumber' },
                        { header: 'Total', key: 'grandTotal' },
                        { header: 'Date', key: 'createdAt' }
                    ];
                    orders.forEach(o => worksheet.addRow(o));
                } else {
                    const items = await Inventory.find({ store: tenantId }).populate('product');
                    worksheet.columns = [
                        { header: 'Product', key: 'name' },
                        { header: 'Qty', key: 'quantity' }
                    ];
                    items.forEach((i: any) => worksheet.addRow({ name: i.product?.name, quantity: i.quantity }));
                }

                if (format === 'csv') await workbook.csv.writeFile(filePath);
                else await workbook.xlsx.writeFile(filePath);
            } else if (format === 'pdf') {
                const doc = new PDFDocument();
                const stream = fs.createWriteStream(filePath);
                doc.pipe(stream);
                doc.fontSize(20).text(`RetailSync ${type.toUpperCase()} Report`, { align: 'center' });
                doc.moveDown();
                // ... (similar PDF logic as controller)
                doc.end();
                await new Promise(resolve => stream.on('finish', resolve));
            }

            // Update report record with success
            reportRecord.status = 'completed';
            reportRecord.fileUrl = `/reports/${fileName}`;
            await reportRecord.save();

        } catch (error: any) {
            console.error(`Report generation failed: ${error.message}`);
            reportRecord.status = 'failed';
            reportRecord.error = error.message;
            await reportRecord.save();
            throw error;
        }

        console.log(`Finished report job: ${job.id}`);
        return { success: true, url: reportRecord.fileUrl };
    }, { connection });

    reportWorker.on('completed', (job) => {
        console.log(`Job ${job.id} completed successfully`);
    });

    reportWorker.on('failed', (job, err) => {
        console.log(`Job ${job?.id} failed with error: ${err.message}`);
    });
}

export { reportWorker };
