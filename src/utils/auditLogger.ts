import AuditLog from '../models/AuditLog.js';
import { Request } from 'express';

interface AuditOptions {
    req: Request;
    storeId: any;
    userId: any;
    action: string;
    entity: string;
    entityId?: any;
    oldValue?: any;
    newValue?: any;
    details?: string;
}

export const logAudit = async (options: AuditOptions) => {
    try {
        await AuditLog.create({
            storeId: options.storeId,
            userId: options.userId,
            action: options.action,
            entity: options.entity,
            entityId: options.entityId,
            oldValue: options.oldValue,
            newValue: options.newValue,
            details: options.details,
            ipAddress: options.req.ip,
            userAgent: options.req.headers['user-agent']
        });
    } catch (error) {
        console.error('Audit Logging Failed:', error);
    }
};
