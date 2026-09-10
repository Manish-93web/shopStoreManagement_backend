# Store360 — Backend

Express/TypeScript/MongoDB API for Store360, a multi-tenant retail SaaS: authentication & RBAC, tenant/store management, product & inventory (with stock transfers, batch/serial tracking), suppliers & procurement, POS billing with GST-compliant invoicing, customer CRM, reports & analytics, notifications, and platform-level subscription billing.

## Stack

- Node.js + Express 5 + TypeScript (ESM)
- MongoDB (Mongoose) + Redis (caching, BullMQ job queues)
- Socket.io for real-time inventory updates
- BullMQ for background jobs (report generation, notification delivery)
- Winston for logging, Sentry for error monitoring

## Getting started

```bash
npm install
cp .env.example .env   # then fill in MONGODB_URI, JWT_SECRET at minimum
npm run dev
```

Runs on `http://localhost:5000` by default (`PORT` in `.env`). Set `SKIP_REDIS=true` to run without a local Redis instance — caching and background jobs are disabled in that mode, everything else works normally.

## Scripts

| Command            | Description                         |
| ------------------ | ----------------------------------- |
| `npm run dev`      | Start with hot reload (`tsx watch`) |
| `npm run build`    | Compile to `dist/`                  |
| `npm run start`    | Run the compiled build              |
| `npm run lint`     | ESLint                              |
| `npm run lint:fix` | ESLint with auto-fix                |
| `npm run format`   | Prettier — write                    |

A pre-commit hook (Husky + lint-staged) runs ESLint and Prettier on staged files automatically.

## Project structure

```
src/
  controllers/   # one file per resource — request handling + business logic
  models/         # Mongoose schemas
  routes/         # Express routers, mounted in app.ts under /api/v1
  middleware/     # auth, tenantHandler, usageLimits, errorHandler...
  services/       # cross-cutting logic (notifications, backups, archiving...)
  queues/ workers/ # BullMQ job queues + processors
  utils/           # logger, ApiResponse, asyncHandler, jwt, auditLogger...
  config/           # db, redis, socket, sentry
```

## External integrations

Payment (Razorpay/Stripe), SMS (Twilio), WhatsApp, email (SMTP), image uploads (Cloudinary), and error monitoring (Sentry) are all real, working integrations — each is gated on its own environment variables and returns a clear "not configured" response rather than a fake success when credentials are missing. See `.env.example` for the full list.

## Environment variables

See `.env.example`. Only `MONGODB_URI` and `JWT_SECRET`/`REFRESH_TOKEN_SECRET` are required to run locally.
