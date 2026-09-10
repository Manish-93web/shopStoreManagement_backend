import nodemailer from 'nodemailer';

interface EmailOptions {
    to: string;
    subject: string;
    html: string;
    templateName?: string;
}

let transporter: nodemailer.Transporter | null = null;

export const sendEmail = async (options: EmailOptions) => {
    try {
        const host = process.env.SMTP_HOST;
        const user = process.env.SMTP_USER;
        const pass = process.env.SMTP_PASS;

        if (!host || !user || !pass) {
            console.log('-----------------------------------------');
            console.log(`[EMAIL NOT CONFIGURED] Set SMTP_HOST/SMTP_USER/SMTP_PASS to send real email.`);
            console.log(`[EMAIL] To: ${options.to}`);
            console.log(`[EMAIL] Subject: ${options.subject}`);
            if (options.templateName) {
                console.log(`[EMAIL] Template: ${options.templateName}`);
            }
            console.log(`[EMAIL] Body length: ${options.html.length} chars`);
            console.log('-----------------------------------------');
            return false;
        }

        if (!transporter) {
            transporter = nodemailer.createTransport({
                host,
                port: Number(process.env.SMTP_PORT) || 587,
                auth: { user, pass },
            });
        }

        await transporter.sendMail({
            from: process.env.SMTP_FROM || 'noreply@retailsync.com',
            to: options.to,
            subject: options.subject,
            html: options.html,
        });

        return true;
    } catch (error) {
        console.error('Email Sending Failed:', error);
        return false;
    }
};
