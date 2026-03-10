import nodemailer from 'nodemailer';

interface EmailOptions {
    to: string;
    subject: string;
    html: string;
}

export const sendEmail = async (options: EmailOptions) => {
    try {
        // Configure using environment variables, or fallback to test/console transport
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
            port: Number(process.env.SMTP_PORT) || 2525,
            auth: {
                user: process.env.SMTP_USER || 'testuser',
                pass: process.env.SMTP_PASS || 'testpass',
            },
        });

        // If no real credentials, just log to console for development
        if (process.env.NODE_ENV === 'development' && !process.env.SMTP_HOST) {
            console.log("-----------------------------------------");
            console.log(`[MOCK EMAIL] To: ${options.to}`);
            console.log(`[MOCK EMAIL] Subject: ${options.subject}`);
            console.log(`[MOCK EMAIL] Body length: ${options.html.length} chars`);
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
