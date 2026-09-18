# RBAC Permission Matrix

Reference document for Store360's role-based access control, compiled directly from the
`authorize(...roles)` calls actually enforced in `src/routes/*.ts` (see `src/middleware/auth.ts`).
This is a description of enforced behavior, not aspirational policy — if this document and the
code ever disagree, the code is correct and this file needs updating.

## Roles

Defined in `src/models/User.ts` (`UserRole` enum):

| Role | Scope |
|---|---|
| `SUPER_ADMIN` | Platform-wide. Not tied to a single store. Explicitly bypasses `checkFeatureAccess()`, `checkTrialExpiry()`, and `checkUsageLimits()` (each special-cases this role first) — but **not** `authorize(...roles)` itself, which is a plain role-membership check with no such special case (`src/middleware/auth.ts`). A route gated by e.g. `authorize('STORE_OWNER')` genuinely rejects a `SUPER_ADMIN` caller unless that role is explicitly listed. In practice `SUPER_ADMIN` reaches per-tenant management through the separate `/api/v1/super-admin/*` surface, not by acting as a store's own staff. |
| `STORE_OWNER` | Full control of the store(s) they own (`user.stores[]`). Only role that can create a new store, manage billing/subscription, or delete most resources. |
| `MANAGER` | Day-to-day operational control of one store (`user.storeId`) — create/update on most resources, but not delete-sensitive actions (employees, suppliers, brands, tax rules) or store-level settings/billing. |
| `CASHIER` | POS/front-of-house. Can transact (orders, stock adjustments at the point of sale) but not manage catalog, suppliers, or settings. |
| `INVENTORY_STAFF` | Stock-focused. No explicit `authorize()` restrictions currently reference this role by name outside the general "any authenticated staff" baseline — see Gaps below. |

## Baseline (applies to every table below)

Every route requires `protect` (valid JWT) and `tenantHandler` (resolves `req.tenantId` from
the JWT/`x-store-id` header and scopes every query to that store — cross-tenant access is
structurally impossible for non-`SUPER_ADMIN` roles, not just permission-gated; `tenantHandler`
itself does let a `SUPER_ADMIN` through even with no store context). A cell marked **Any** means
the route has no `authorize()` call at all — just `protect`/`tenantHandler` (and, where noted,
`checkFeatureAccess`/`checkTrialExpiry`) — so a `SUPER_ADMIN` genuinely reaches it too (by
supplying `x-store-id` to act on a given tenant), same as any role. Wherever a row instead
lists specific roles, `SUPER_ADMIN` gets **✅ only if the route's `authorize()` call explicitly
names it** — otherwise it is genuinely blocked, per the correction above.

Two further gates apply on top of role, independent of this matrix:
- `checkTrialExpiry` — blocks all non-`SUPER_ADMIN` access once a store's trial has expired or
  its subscription is cancelled/past-due (deliberately **not** applied to billing/account-settings
  routes, so a suspended store owner can still fix their subscription).
- `checkFeatureAccess('<feature>')` — blocks access unless the store's plan (or an explicit
  override) includes that named feature (e.g. `/analytics/*` requires `'Basic Analytics'`,
  `/analytics/prediction` additionally requires `'AI Predictions'`).

## Store & Tenant Management

| Action | SUPER_ADMIN | STORE_OWNER | MANAGER | CASHIER | INVENTORY_STAFF |
|---|:---:|:---:|:---:|:---:|:---:|
| List all stores (platform-wide) | ✅ | – | – | – | – |
| Create a store | – | ✅ | – | – | – |
| Update a store | ✅ | ✅ (own) | – | – | – |
| Suspend / reactivate a store | ✅ | – | – | – | – |
| List/view own store(s) | ✅ | ✅ | ✅ | ✅ | ✅ |

## Products, Categories, Brands, Variants

| Action | SUPER_ADMIN | STORE_OWNER | MANAGER | CASHIER | INVENTORY_STAFF |
|---|:---:|:---:|:---:|:---:|:---:|
| View products/categories/brands | ✅ | Any | Any | Any | Any |
| Create/update product, variant | – | ✅ | ✅ | – | – |
| Delete product | – | ✅ | ✅ | – | – |
| Bulk update products (`PUT /products/bulk`, JSON) | – | ✅ | ✅ | – | – |
| Bulk import products (`POST /import/products`, Excel/CSV) | ✅ | ✅ | – | – | – |
| Adjust stock (POS-side quantity correction) | – | ✅ | ✅ | ✅ | – |
| Create/update category | – | ✅ | ✅ | – | – |
| Delete category | – | ✅ | ✅ | – | – |
| Create/update brand | – | ✅ | ✅ | – | – |
| Delete brand | – | ✅ | – | – | – |

There are two independent bulk-product-update code paths with different permissions — see
the "Bulk update" vs "Bulk import" rows above and the Known Gaps note below.

## Inventory & Transfers

| Action | SUPER_ADMIN | STORE_OWNER | MANAGER | CASHIER | INVENTORY_STAFF |
|---|:---:|:---:|:---:|:---:|:---:|
| View inventory, batches, serials, stock history | ✅ | Any | Any | Any | Any |
| Create batch / serial entries | ✅ | Any | Any | Any | Any |
| Create / approve / ship / receive a transfer | – | ✅ | ✅ | – | – |

## Suppliers & Procurement

| Action | SUPER_ADMIN | STORE_OWNER | MANAGER | CASHIER | INVENTORY_STAFF |
|---|:---:|:---:|:---:|:---:|:---:|
| View suppliers / purchase orders / payments | ✅ | Any | Any | Any | Any |
| Create/update supplier | – | ✅ | ✅ | – | – |
| Delete supplier | – | ✅ | – | – | – |
| Create / approve / receive a purchase order | – | ✅ | ✅ | – | – |
| Record a supplier payment | – | ✅ | ✅ | – | – |
| Log a supplier contact | ✅ | Any | Any | Any | Any |

## POS, Orders, Returns & Exchanges

| Action | SUPER_ADMIN | STORE_OWNER | MANAGER | CASHIER | INVENTORY_STAFF |
|---|:---:|:---:|:---:|:---:|:---:|
| Create an order (checkout) | ✅ | Any | Any | Any | Any |
| View / cancel an order | ✅ | Any | Any | Any | Any |
| Process a return / exchange | ✅ | Any | Any | Any | Any |
| Open / close a cash-drawer shift | ✅ | Any | Any | Any | Any |
| View all staff shifts (oversight) | ✅ | ✅ | ✅ | – | – |

## Customers, Loyalty & Wallet

| Action | SUPER_ADMIN | STORE_OWNER | MANAGER | CASHIER | INVENTORY_STAFF |
|---|:---:|:---:|:---:|:---:|:---:|
| View / create / update customer | ✅ | Any | Any | Any | Any |
| Adjust loyalty points / wallet balance | ✅ | Any | Any | Any | Any |
| Import / export customers | ✅ | Any | Any | Any | Any |

## Employees & Attendance

| Action | SUPER_ADMIN | STORE_OWNER | MANAGER | CASHIER | INVENTORY_STAFF |
|---|:---:|:---:|:---:|:---:|:---:|
| View employees / staff performance | ✅ | ✅ | ✅ | – | – |
| Create / update employee | – | ✅ | ✅ | – | – |
| Delete employee | – | ✅ | – | – | – |
| Clock in / out (own attendance) | ✅ | Any | Any | Any | Any |

## Marketing, Discounts & Promotions

| Action | SUPER_ADMIN | STORE_OWNER | MANAGER | CASHIER | INVENTORY_STAFF |
|---|:---:|:---:|:---:|:---:|:---:|
| View coupons / promotion rules | – | ✅ | ✅ | – | – |
| Create coupon / promotion rule | – | ✅ | ✅ | – | – |
| Validate a coupon at checkout | ✅ | Any | Any | Any | Any |

## Reports, Analytics & Accounting

| Action | SUPER_ADMIN | STORE_OWNER | MANAGER | CASHIER | INVENTORY_STAFF |
|---|:---:|:---:|:---:|:---:|:---:|
| Run/export any report | ✅ | Any\* | Any\* | Any\* | Any\* |
| View analytics dashboards | ✅ | Any\* | Any\* | Any\* | Any\* |
| View accounting/ledger transactions | ✅ | Any | Any | Any | Any |

\* Also requires the store's plan to include `'Basic Analytics'` (and, for sales-prediction,
`'AI Predictions'`) — see `checkFeatureAccess` in the Baseline section above.

## Settings, Currencies, Tax Rules, Backups, Archive, API Keys, Webhooks

| Action | SUPER_ADMIN | STORE_OWNER | MANAGER | CASHIER | INVENTORY_STAFF |
|---|:---:|:---:|:---:|:---:|:---:|
| Update store settings | – | ✅ | – | – | – |
| Create/update currency | – | ✅ | ✅ | – | – |
| Create/update/delete tax rule | – | ✅ | – | – | – |
| Export / trigger / restore a backup | – | ✅ | – | – | – |
| View / run archive jobs | – | ✅ | – | – | – |
| Create / update / delete an API key | – | ✅ | – | – | – |
| Create / update / delete an outgoing webhook, view its delivery logs | – | ✅ | – | – | – |

## Subscriptions & Billing

| Action | SUPER_ADMIN | STORE_OWNER | MANAGER | CASHIER | INVENTORY_STAFF |
|---|:---:|:---:|:---:|:---:|:---:|
| Upgrade plan / checkout (own store) | – | ✅ | – | – | – |
| List all plans (store-owner-facing) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create / update / delete a plan (platform catalog) | ✅ | – | – | – | – |
| View all invoices (platform-wide) | ✅ | – | – | – | – |

## Super Admin Platform (`/api/v1/super-admin/*`)

Every route under this prefix requires `authorize('SUPER_ADMIN')` at the router level
(`superAdminRoutes.ts`) — no other role can reach any of it: tenant list/suspend/analytics,
platform-wide audit logs, system health, targeted/broadcast tenant notifications, feature
flags, platform billing reports.

## Known gaps (honest, not silently patched over)

- **`INVENTORY_STAFF` has no role-specific `authorize()` grants anywhere in the codebase.**
  In practice this role can reach anything gated only by `protect`/`tenantHandler` (i.e. every
  "Any" cell above) but is excluded from everything `CASHIER` and above can do. If the product
  intent is "inventory staff can adjust stock but not run POS," that needs an explicit
  `authorize('STORE_OWNER', 'MANAGER', 'INVENTORY_STAFF')` added to `PATCH /products/:id/adjust`
  — currently that route excludes this role, which look like an oversight given the role's name.
- Several read-heavy resources (orders, customers, inventory, suppliers) intentionally have no
  `authorize()` beyond tenant scoping — any authenticated staff member of the store can read and
  transact against them. This matches a typical single-location retail POS (one shared terminal,
  trusted staff) rather than a segregated-duties enterprise model; flagging it here as a
  deliberate scope decision, not an oversight, so it isn't "rediscovered" as a bug later.
- **Bulk product update has two independent code paths with different permission levels**:
  `PUT /products/bulk` (JSON body) allows `STORE_OWNER`+`MANAGER`; `POST /import/products`
  (Excel/CSV upload) allows only `STORE_OWNER` (+`SUPER_ADMIN`). This may be a deliberate safety
  measure — a spreadsheet import can touch far more rows at once with less per-item review than
  a JSON bulk-update call — but it's flagged here rather than silently normalized, since it could
  equally be an oversight from the two paths having been built at different times.

## Fixed during this document's own review

- **API keys and outgoing webhooks previously had zero `authorize()` restriction** — any
  authenticated staff member, including `CASHIER`/`INVENTORY_STAFF`, could create or delete them
  (an API key grants programmatic access to the whole store API; a webhook can point at any
  external URL). Found during an adversarial re-check of this document, fixed by adding
  `authorize('STORE_OWNER')` to both `src/routes/apiKeyRoutes.ts` and
  `src/routes/webhookRoutes.ts`, and by hiding the corresponding Settings tabs in the frontend
  for non-owner roles. Verified live: a real `CASHIER`-role user now gets 403 on both.
