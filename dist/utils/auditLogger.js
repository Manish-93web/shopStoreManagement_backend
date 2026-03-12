import AuditLog from '../models/AuditLog.js';
export const logAudit = async (options) => {
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
    }
    catch (error) {
        console.error('Audit Logging Failed:', error);
    }
};
