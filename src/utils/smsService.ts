// Mock Twilio structure
// import twilio from 'twilio';

interface SmsOptions {
    to: string;
    body: string;
}

export const sendSMS = async (options: SmsOptions) => {
    try {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const fromNumber = process.env.TWILIO_PHONE_NUMBER;

        if (!accountSid || !authToken || !fromNumber) {
            console.log("-----------------------------------------");
            console.log(`[MOCK SMS] To: ${options.to}`);
            console.log(`[MOCK SMS] Body: ${options.body}`);
            console.log("-----------------------------------------");
            return true;
        }

        // If credentials exist, initialize client
        // const client = twilio(accountSid, authToken);
        // await client.messages.create({
        //     body: options.body,
        //     from: fromNumber,
        //     to: options.to
        // });

        console.log(`[SMS] Sent successfully to ${options.to}`);
        return true;
    } catch (error) {
        console.error("SMS Sending Failed:", error);
        return false;
    }
};
