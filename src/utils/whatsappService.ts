interface WhatsappOptions {
    to: string;
    body: string;
    templateName?: string;
}

export const sendWhatsApp = async (options: WhatsappOptions) => {
    try {
        // Mock WhatsApp integration (e.g., via Twilio or 360dialog)
        console.log("-----------------------------------------");
        console.log(`[WHATSAPP] To: ${options.to}`);
        if (options.templateName) {
            console.log(`[WHATSAPP] Template: ${options.templateName}`);
        }
        console.log(`[WHATSAPP] Message: ${options.body}`);
        console.log("-----------------------------------------");

        return true;
    } catch (error) {
        console.error("WhatsApp Sending Failed:", error);
        return false;
    }
};
