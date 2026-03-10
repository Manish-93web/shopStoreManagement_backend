import { Response } from 'express';
import CashRegisterSession from '../models/CashRegisterSession.js';
import { TenantRequest } from '../middleware/tenantHandler.js';

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
            if (activeSession) return res.status(400).json({ message: "You already have an active session." });

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
            res.status(201).json({ success: true, data: session });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    },

    closeSession: async (req: TenantRequest, res: Response) => {
        try {
            const { closingBalance, notes } = req.body;
            const session = await CashRegisterSession.findOne({
                cashier: req.user?._id,
                status: 'Open'
            });
            if (!session) return res.status(404).json({ message: "No active session found." });

            // Calculate expected balance (In a real app, this would sum up all PaymentTransactions in this shift)
            // For now, using a placeholder logic
            const expectedBalance = session.openingBalance + 5000; // Mocked expected income

            session.closingBalance = closingBalance;
            session.expectedBalance = expectedBalance;
            session.difference = closingBalance - expectedBalance;
            session.closingTime = new Date();
            session.status = 'Closed';
            session.notes = notes;

            await session.save();
            res.json({ success: true, data: session });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
};
