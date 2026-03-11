import nodemailer from 'nodemailer';

interface EmailOptions {
    to: string;
    subject: string;
    html: string;
    templateName?: string;
}

export const sendEmail = async (options: EmailOptions) => {
    try {
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
            port: Number(process.env.SMTP_PORT) || 2525,
            auth: {
                user: process.env.SMTP_USER || 'testuser',
                pass: process.env.SMTP_PASS || 'testpass',
            },
        });

        // Enhanced logging for templates
        if (process.env.NODE_ENV === 'development' && !process.env.SMTP_HOST) {
            console.log("-----------------------------------------");
            console.log(`[EMAIL] To: ${options.to}`);
            console.log(`[EMAIL] Subject: ${options.subject}`);
            if (options.templateName) {
                console.log(`[EMAIL] Template: ${options.templateName}`);
            }
            console.log(`[EMAIL] Body length: ${options.html.length} chars`);
            console.log("-----------------------------------------");
            return true;
        }

        await transporter.sendMail({
            from: process.env.SMTP_FROM || 'noreply@retailsync.com',
            to: options.to,
            subject: options.subject,
            html: options.html,
        });

        return true;
    } catch (error) {
        console.error("Email Sending Failed:", error);
        return false;
    }
};
