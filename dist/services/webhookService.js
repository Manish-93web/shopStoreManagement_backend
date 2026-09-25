import axios from 'axios';
import crypto from 'crypto';
import Webhook from '../models/Webhook.js';
import WebhookLog from '../models/WebhookLog.js';
import { addWebhookJob } from '../queues/webhookQueue.js';
class WebhookService {
    /**
     * Trigger webhooks for a specific event
     * @param event The event being triggered (e.g. 'order.created')
     * @param tenantId The tenant associated with the event
     * @param payload The data to send
     */
    async trigger(event, tenantId, payload) {
        try {
            // Find active webhooks for this event and tenant
            const webhooks = await Webhook.find({
                tenantId,
                isActive: true,
                events: event
            });
            if (webhooks.length === 0)
                return;
            for (const webhook of webhooks) {
                const queued = await addWebhookJob({
                    webhookId: webhook._id.toString(),
                    event,
                    payload,
                });
                if (!queued) {
                    // No queue available (Redis disabled) — dispatch immediately,
                    // same as before, just without automatic retry on failure.
                    this.dispatch(webhook, event, payload, 1).catch(() => {
                        // already logged to WebhookLog inside dispatch()
                    });
                }
            }
        }
        catch (error) {
            console.error('Error triggering webhooks:', error);
        }
    }
    /**
     * Dispatch a single webhook request. Public so the BullMQ worker can call
     * it directly per retry attempt — rethrows on failure so a failed HTTP
     * delivery becomes a failed BullMQ job, which is what makes the queue's
     * `attempts`/`backoff` config actually retry instead of silently giving up
     * after one try (the old behavior, hardcoded to `attempt: 1`).
     */
    async dispatch(webhook, event, payload, attempt) {
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
                attempt
            });
        }
        catch (error) {
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
                attempt
            });
            console.error(`Webhook delivery failed to ${webhook.url} (attempt ${attempt}):`, error.message);
            throw error;
        }
    }
}
export default new WebhookService();
