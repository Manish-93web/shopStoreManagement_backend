import twilio from 'twilio';
let client = null;
export const sendSMS = async (options) => {
    try {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const fromNumber = process.env.TWILIO_PHONE_NUMBER;
        if (!accountSid || !authToken || !fromNumber) {
            console.log('-----------------------------------------');
            console.log(`[SMS NOT CONFIGURED] Set TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_PHONE_NUMBER to send real SMS.`);
            console.log(`[SMS] To: ${options.to}`);
            console.log(`[SMS] Body: ${options.body}`);
            console.log('-----------------------------------------');
            return false;
        }
        if (!client) {
            client = twilio(accountSid, authToken);
        }
        const message = await client.messages.create({
            body: options.body,
            from: fromNumber,
            to: options.to,
        });
        console.log(`[SMS] Sent successfully to ${options.to} (SID: ${message.sid})`);
        return true;
    }
    catch (error) {
        console.error('SMS Sending Failed:', error);
        return false;
    }
};
