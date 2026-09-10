import { Worker, Job } from 'bullmq';
import Order from '../models/Order.js';
import Inventory from '../models/Inventory.js';
import Report from '../models/Report.js';
import User from '../models/User.js';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { sendEmail } from '../utils/emailService.js';

const APP_URL = process.env.APP_URL || `http://localhost:${process.env.PORT || 5000}`;

const connection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
};

let reportWorker: Worker | null = null;

if (process.env.SKIP_REDIS !== 'true') {
    reportWorker = new Worker(
        'report-generation',
        async (job: Job) => {
            const { tenantId, type, filters, format, userId } = job.data;
            console.log(`Working on report job: ${job.id} for tenant: ${tenantId}`);

            // Update report status to processing
            const reportRecord = await Report.create({
                storeId: tenantId,
                type,
                status: 'processing',
                format,
                filters,
                generatedBy: userId,
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
                            { header: 'Date', key: 'createdAt' },
                        ];
                        orders.forEach((o) => worksheet.addRow(o));
                    } else {
                        const items = await Inventory.find({ store: tenantId }).populate('product');
                        worksheet.columns = [
                            { header: 'Product', key: 'name' },
                            { header: 'Qty', key: 'quantity' },
                        ];
                        items.forEach((i: any) => worksheet.addRow({ name: i.product?.name, quantity: i.quantity }));
                    }

                    if (format === 'csv') await workbook.csv.writeFile(filePath);
                    else await workbook.xlsx.writeFile(filePath);
                } else if (format === 'pdf') {
                    const doc = new PDFDocument();
                    const stream = fs.createWriteStream(filePath);
                    doc.pipe(stream);
                    doc.fontSize(20).text(`Store360 ${type.toUpperCase()} Report`, { align: 'center' });
                    doc.moveDown();
                    // ... (similar PDF logic as controller)
                    doc.end();
                    await new Promise((resolve) => stream.on('finish', resolve));
                }

                // Update report record with success
                reportRecord.status = 'completed';
                reportRecord.fileUrl = `/report-files/${fileName}`;
                await reportRecord.save();

                // Notify the requesting user by email — honest no-op (console log) when SMTP isn't configured
                const requester = await User.findById(userId);
                if (requester?.email) {
                    await sendEmail({
                        to: requester.email,
                        subject: `Your ${type} report is ready`,
                        html: `<p>Your ${type} report (${format.toUpperCase()}) has finished generating.</p><p><a href="${APP_URL}${reportRecord.fileUrl}">Download report</a></p>`,
                    });
                }
            } catch (error: any) {
                console.error(`Report generation failed: ${error.message}`);
                reportRecord.status = 'failed';
                reportRecord.error = error.message;
                await reportRecord.save();
                throw error;
            }

            console.log(`Finished report job: ${job.id}`);
            return { success: true, url: reportRecord.fileUrl };
        },
        { connection }
    );

    reportWorker.on('completed', (job) => {
        console.log(`Job ${job.id} completed successfully`);
    });

    reportWorker.on('failed', (job, err) => {
        console.log(`Job ${job?.id} failed with error: ${err.message}`);
    });
}

export { reportWorker };
