import axios from 'axios';
import crypto from 'crypto';
import Webhook from '../models/Webhook.js';
import WebhookLog from '../models/WebhookLog.js';

class WebhookService {
    /**
     * Trigger webhooks for a specific event
     * @param event The event being triggered (e.g. 'order.created')
     * @param tenantId The tenant associated with the event
     * @param payload The data to send
     */
    async trigger(event: string, tenantId: string, payload: any) {
        try {
            // Find active webhooks for this event and tenant
            const webhooks = await Webhook.find({
                tenantId,
                isActive: true,
                events: event
            });

            if (webhooks.length === 0) return;

            // Dispatch to each webhook asynchronously
            webhooks.forEach(async (webhook) => {
                await this.dispatch(webhook, event, payload);
            });
        } catch (error) {
            console.error('Error triggering webhooks:', error);
        }
    }

    /**
     * Dispatch a single webhook request
     */
    private async dispatch(webhook: any, event: string, payload: any) {
        const timestamp = Date.now().toString();
        const body = JSON.stringify(payload);

        // Generate HMAC signature
        const signature = crypto
            .createHmac('sha256', webhook.secret)
            .update(`${timestamp}.${body}`)
            .digest('hex');

        try {
            const response = await axios.post(webhook.url, body, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Webhook-Event': event,
                    'X-Webhook-Timestamp': timestamp,
                    'X-Webhook-Signature': signature,
                    'User-Agent': 'Retail-SaaS-Webhook-Dispatcher'
                },
                timeout: 5000 // 5 second timeout
            });

            // Log success
            await WebhookLog.create({
                webhookId: webhook._id,
                event,
                payload,
                responseCode: response.status,
                responseBody: typeof response.data === 'string' ? response.data : JSON.stringify(response.data),
                status: 'success',
                tenantId: webhook.tenantId,
                attempt: 1
            });
        } catch (error: any) {
            // Log failure
            await WebhookLog.create({
                webhookId: webhook._id,
                event,
                payload,
                responseCode: error.response?.status,
                responseBody: error.response?.data ? JSON.stringify(error.response.data) : undefined,
                status: 'failed',
                errorMessage: error.message,
                tenantId: webhook.tenantId,
                attempt: 1
            });
            console.error(`Webhook delivery failed to ${webhook.url}:`, error.message);
        }
    }
}

export default new WebhookService();
