import { Response } from 'express';
import CashRegisterSession from '../models/CashRegisterSession.js';
import Order from '../models/Order.js';
import { TenantRequest } from '../middleware/tenantHandler.js';
import ApiResponse from '../utils/apiResponse.js';

export const sessionController = {
    openSession: async (req: TenantRequest, res: Response) => {
        try {
            const { openingBalance, notes } = req.body;
            const storeId = req.tenantId;
            const cashierId = req.user?._id;

            // Check if cashier already has an open session
            const activeSession = await CashRegisterSession.findOne({
                cashier: cashierId,
                status: 'Open'
            });
            if (activeSession) return res.status(400).json(new ApiResponse(400, null, "You already have an active session."));

            const sessionNumber = `REG-${Date.now()}`;
            const session = new CashRegisterSession({
                sessionNumber,
                storeId,
                cashier: cashierId,
                openingBalance,
                openingTime: new Date(),
                status: 'Open',
                notes
            });

            await session.save();
            res.status(201).json(new ApiResponse(201, session, "Session started successfully"));
        } catch (error: any) {
            res.status(500).json(new ApiResponse(500, null, error.message));
        }
    },

    closeSession: async (req: TenantRequest, res: Response) => {
        try {
            const { closingBalance, notes } = req.body;
            const session = await CashRegisterSession.findOne({
                cashier: req.user?._id,
                status: 'Open'
            }).populate('cashier', 'name');

            if (!session) return res.status(404).json(new ApiResponse(404, null, "No active session found."));

            // Get all orders created during this session
            const orders = await Order.find({
                storeId: req.tenantId,
                cashier: req.user?._id,
                createdAt: { $gte: session.openingTime },
                status: 'Completed'
            });

            const summary = {
                totalSales: 0,
                totalOrders: orders.length,
                cashSales: 0,
                cardSales: 0,
                upiSales: 0,
                walletSales: 0,
                refunds: 0
            };

            orders.forEach(order => {
                summary.totalSales += order.grandTotal;
                order.paymentDetails.forEach(p => {
                    if (p.method === 'Cash') summary.cashSales += p.amount;
                    if (p.method === 'Card') summary.cardSales += p.amount;
                    if (p.method === 'UPI') summary.upiSales += p.amount;
                    if (p.method === 'Wallet') summary.walletSales += p.amount;
                });
            });

            const expectedBalance = session.openingBalance + summary.cashSales;

            session.closingBalance = closingBalance;
            session.expectedBalance = expectedBalance;
            session.difference = closingBalance - expectedBalance;
            session.closingTime = new Date();
            session.status = 'Closed';
            session.notes = notes;
            session.shiftSummary = summary;

            await session.save();
            res.status(200).json(new ApiResponse(200, session, "Session closed successfully"));
        } catch (error: any) {
            res.status(500).json(new ApiResponse(500, null, error.message));
        }
    },

    getActiveSession: async (req: TenantRequest, res: Response) => {
        const session = await CashRegisterSession.findOne({
            cashier: req.user?._id,
            status: 'Open'
        });
        res.status(200).json(new ApiResponse(200, session));
    }
};
