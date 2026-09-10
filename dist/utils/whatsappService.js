import twilio from 'twilio';
let client = null;
const asWhatsappAddress = (raw) => (raw.startsWith('whatsapp:') ? raw : `whatsapp:${raw}`);
// Uses Twilio's WhatsApp API (the same account as smsService.ts) rather than a
// separate Meta Cloud API integration, since Twilio is already the SMS provider here.
export const sendWhatsApp = async (options) => {
    try {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER;
        if (!accountSid || !authToken || !fromNumber) {
            console.log('-----------------------------------------');
            console.log(`[WHATSAPP NOT CONFIGURED] Set TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_WHATSAPP_NUMBER to send real WhatsApp messages.`);
            console.log(`[WHATSAPP] To: ${options.to}`);
            if (options.templateName) {
                console.log(`[WHATSAPP] Template: ${options.templateName}`);
            }
            console.log(`[WHATSAPP] Message: ${options.body}`);
            console.log('-----------------------------------------');
            return false;
        }
        if (!client) {
            client = twilio(accountSid, authToken);
        }
        const message = await client.messages.create({
            body: options.body,
            from: asWhatsappAddress(fromNumber),
            to: asWhatsappAddress(options.to),
        });
        console.log(`[WHATSAPP] Sent successfully to ${options.to} (SID: ${message.sid})`);
        return true;
    }
    catch (error) {
        console.error('WhatsApp Sending Failed:', error);
        return false;
    }
};
