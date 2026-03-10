import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

export const initSentry = () => {
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        integrations: [
            nodeProfilingIntegration(),
        ],
        // Performance Monitoring
        tracesSampleRate: 1.0,
        // Set sampling rate for profiling - this is relative to tracesSampleRate
        profilesSampleRate: 1.0,
    });
};

export const sentryContextMiddleware = (req: any, res: any, next: any) => {
    if (req.tenantId) {
        Sentry.setTag("tenant_id", req.tenantId.toString());
    }
    if (req.user) {
        Sentry.setUser({ id: req.user._id.toString(), email: req.user.email });
    }
    next();
};

export default Sentry;
