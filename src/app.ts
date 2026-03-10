import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes.js';
import productRoutes from './routes/productRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import purchaseOrderRoutes from './routes/purchaseOrderRoutes.js';
import customerRoutes from './routes/customerRoutes.js';
import walletRoutes from './routes/walletRoutes.js';
import storeRoutes from './routes/storeRoutes.js';
import discountRoutes from './routes/discountRoutes.js';
import transferRoutes from './routes/transferRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import employeeRoutes from './routes/employeeRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';
import returnRoutes from './routes/returnRoutes.js';
import shiftRoutes from './routes/shiftRoutes.js';
import supplierRoutes from './routes/supplierRoutes.js';
import supplierPaymentRoutes from './routes/supplierPaymentRoutes.js';
import brandRoutes from './routes/brandRoutes.js';
import taxRuleRoutes from './routes/taxRuleRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import sessionRoutes from './routes/sessionRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import inventoryDetailRoutes from './routes/inventoryDetailRoutes.js';
import backupRoutes from './routes/backupRoutes.js';
import searchRoutes from './routes/searchRoutes.js';
import importRoutes from './routes/importRoutes.js';
import subscriptionRoutes from './routes/subscriptionRoutes.js';
import webhookRoutes from './routes/webhookRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import superAdminRoutes from './routes/superAdminRoutes.js';
import rateLimit from 'express-rate-limit';
import * as Sentry from "@sentry/node";
import { sentryContextMiddleware } from './config/sentry.js';

const app: Application = express();

// Middleware
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(sentryContextMiddleware);

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests from this IP, please try again after 15 minutes'
});
app.use('/api/v1', limiter);

// API v1 Routes
const v1 = express.Router();

// Auth & Core
v1.use('/auth', authRoutes);

// Store Management
v1.use('/products', productRoutes);
v1.use('/categories', productRoutes); // categories are sub-routed inside productRoutes
v1.use('/orders', orderRoutes);
v1.use('/purchase-orders', purchaseOrderRoutes);
v1.use('/customers', customerRoutes);
v1.use('/wallets', walletRoutes);
v1.use('/stores', storeRoutes);

// Inventory & Supply
v1.use('/suppliers', supplierRoutes);
v1.use('/supplier-payments', supplierPaymentRoutes);
v1.use('/transfers', transferRoutes);

// POS Enhancements
v1.use('/discounts', discountRoutes);

// HR
v1.use('/employees', employeeRoutes);
v1.use('/attendance', attendanceRoutes);
v1.use('/shifts', shiftRoutes);

// Returns & Sessions
v1.use('/returns', returnRoutes);
v1.use('/sessions', sessionRoutes);
v1.use('/notifications', notificationRoutes);
v1.use('/inventory-details', inventoryDetailRoutes);
v1.use('/backup', backupRoutes);
v1.use('/search', searchRoutes);
v1.use('/import', importRoutes);
v1.use('/subscriptions', subscriptionRoutes);
v1.use('/webhooks', webhookRoutes);

// Reporting
v1.use('/reports', reportRoutes);
v1.use('/analytics', analyticsRoutes);
v1.use('/super-admin', superAdminRoutes);

// Expansion Pack
v1.use('/brands', brandRoutes);
v1.use('/tax-rules', taxRuleRoutes);
v1.use('/settings', settingsRoutes);

app.use('/api/v1', v1);

// Health Check
app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'OK', message: 'RetailSync API is running', timestamp: new Date().toISOString() });
});

// Sentry Error Handler
Sentry.setupExpressErrorHandler(app);

export default app;
