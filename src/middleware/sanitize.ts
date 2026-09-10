import { Request, Response, NextFunction } from 'express';
import sanitizeHtml from 'sanitize-html';

// Defense-in-depth beyond React's default escaping: strips any HTML/script content
// from free-text fields (product/category descriptions, customer/supplier notes, etc.)
// before it's persisted, so a stored value can never execute in another context that
// doesn't auto-escape (an email template, an exported report, a future admin view).
const stripHtml = (value: string) => sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }).trim();

export const sanitizeFields =
    (...fields: string[]) =>
    (req: Request, _res: Response, next: NextFunction) => {
        if (req.body && typeof req.body === 'object') {
            for (const field of fields) {
                if (typeof req.body[field] === 'string') {
                    req.body[field] = stripHtml(req.body[field]);
                }
            }
        }
        next();
    };
