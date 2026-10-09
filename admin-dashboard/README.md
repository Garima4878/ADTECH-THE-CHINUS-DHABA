# The Chinu Family Restaurant & Dhaba — Admin Dashboard

Restaurant-side admin dashboard. **This repository contains only the admin/restaurant dashboard frontend.**
The customer-facing website (QR Scan → Table → Menu → Cart → Order → Payment → Verification → Confirmation)
and the Node/Express backend are separate projects and are intentionally not included here.

No static/mock data anywhere — every screen reads from the backend API.

## Stack

- React 18 + TypeScript + Vite
- React Router
- TanStack Query (caching, refetching, optimistic status updates)
- Tailwind CSS

## Run

```bash
npm install
cp .env.example .env      # then set VITE_PROXY_TARGET to your backend port
npm run dev               # http://localhost:5173
```

Production build:

```bash
npm run build
npm run preview
npm run typecheck
```

### Environment

| Variable | Purpose |
| --- | --- |
| `VITE_API_BASE_URL` | Base URL for all calls. Default `/api`. In production set the full origin (e.g. `https://api.chinudhaba.com/api`). |
| `VITE_PROXY_TARGET` | Dev only. Where the Express backend runs (default `http://localhost:5000`). Vite proxies `/api` to it, so no CORS setup is needed locally. |

### Login

The login screen is a plain form — **no authentication**. Enter any username and password and the
dashboard opens immediately. The name is kept in `localStorage` so a refresh stays signed in, and
**Sign out** clears it.

The **Sign in as** dropdown picks the permission level for the session, so each role can be reviewed
without the backend:

| Option | What you can do |
| --- | --- |
| Administrator | Everything, including Staff & Roles |
| Manager | Orders, menu, categories, tables, payments. No staff management. |
| Restaurant Employee | View and advance orders, read-only menu and tables. |

When the real backend is ready, replace `signIn` in `src/providers/AuthProvider.tsx` with a call to
`POST /admin/auth/login` and send the returned token as an `Authorization: Bearer` header in
`src/lib/api.ts`. No page code needs to change.

## Screens

| Route | Screen | Notes |
| --- | --- | --- |
| `/login` | Staff sign-in | Username + password. No signup; accounts come from the backend. |
| `/dashboard` | New orders + status updates | Order cards, live stat tiles, status filters, search. |
| `/orders` | Order history | Filters by status, payment, type, date range, search. |
| `/orders/:id` | Order detail | Timeline, items, totals, status history, mark-as-paid. |
| `/kitchen` | Kitchen screen | Column board per stage, tap to advance. |
| `/tables` | Tables | Floor status, capacity, add/edit/delete. |
| `/menu` | Menu items | Grouped by category, availability toggle, veg/non-veg. |
| `/categories` | Categories | Manager/admin only. |
| `/payments` | Payments | Status, method, date filters. |
| `/staff` | Staff & roles | **Admin only.** Create employee logins and set roles. |

## Order status flow

```
PENDING → ACCEPTED → PREPARING → READY → COMPLETED
   └────────────────── Cancelled (admin/manager only, before Preparing)
```

Each action button calls:

```http
PATCH /api/admin/orders/:id/status
Content-Type: application/json

{ "status": "Accepted" }
```

Accepted values are `Pending`, `Accepted`, `Preparing`, `Ready`, `Completed`, `Cancelled`.
The card renders optimistically and rolls back if the PATCH fails.

## Roles and permissions

| Capability | admin | manager | employee |
| --- | :---: | :---: | :---: |
| View orders / kitchen | ✅ | ✅ | ✅ |
| Advance order status | ✅ | ✅ | ✅ |
| Cancel order | ✅ | ✅ | ❌ |
| View menu | ✅ | ✅ | ✅ |
| Edit menu & categories | ✅ | ✅ | ❌ |
| View tables | ✅ | ✅ | ✅ |
| Manage tables | ✅ | ✅ | ❌ |
| View payments | ✅ | ✅ | ❌ |
| Manage staff accounts | ✅ | ❌ | ❌ |

Permission mapping lives in `src/lib/permissions.ts`. Routes and sidebar entries are filtered by role,
so employees never see admin-only screens. **The backend must also enforce this** — the frontend guard is UX only.

## API contract expected from the backend

All paths are relative to `VITE_API_BASE_URL`.

### Orders

```http
GET /admin/orders?status=&paymentStatus=&orderType=&tableId=&search=&from=&to=&page=&limit=
GET /admin/orders/:id

PATCH /admin/orders/:id/status
{ "status": "Accepted" }
→ updated order

PATCH /admin/orders/:id/payment
{ "status": "Paid", "method": "UPI" }
→ updated order
```

Order shape:

```jsonc
{
  "id": "65f...",
  "orderNumber": 1024,
  "tableId": "65f...",
  "tableNumber": "T05",
  "customerName": "Rahul",
  "customerPhone": "98xxxxxxx",
  "orderType": "DineIn",            // DineIn | Takeaway | Delivery
  "items": [
    { "id": "1", "name": "Chicken Biryani", "quantity": 2, "price": 325, "notes": "extra spicy" }
  ],
  "totalAmount": 750,
  "discountAmount": 0,
  "taxAmount": 0,
  "status": "Pending",
  "paymentStatus": "Paid",          // Paid | Unpaid | Partial | Refunded
  "placedAt": "2026-10-01T10:12:00Z",
  "notes": "serve after starter",
  "statusHistory": [{ "status": "Pending", "at": "2026-10-01T10:12:00Z", "by": "Rahul" }]
}
```

### Dashboard stats

```http
GET /admin/dashboard/stats
→ {
    "todayOrders": 42, "todayRevenue": 38650, "pendingOrders": 3,
    "activeOrders": 7, "completedOrders": 30, "cancelledOrders": 2,
    "unpaidAmount": 1250, "occupiedTables": 6, "totalTables": 12
  }
```

### Menu

```http
GET    /admin/menu/items
POST   /admin/menu/items
PUT    /admin/menu/items/:id
PATCH  /admin/menu/items/:id/availability   { "isAvailable": false }
DELETE /admin/menu/items/:id

GET    /admin/menu/categories
POST   /admin/menu/categories
PUT    /admin/menu/categories/:id
DELETE /admin/menu/categories/:id
```

### Tables

```http
GET    /admin/tables
POST   /admin/tables
PUT    /admin/tables/:id
PATCH  /admin/tables/:id/status   { "status": "Occupied" }
DELETE /admin/tables/:id
```

Table status: `Free` | `Occupied` | `Reserved` | `Cleaning`.

### Payments

```http
GET /admin/payments?status=&method=&from=&to=&page=&limit=
→ { "data": [ { "id", "orderId", "orderNumber", "tableNumber", "status", "method", "amount", "paidAmount", "transactionId", "paidAt" } ],
    "meta": { "page": 1, "limit": 20, "total": 100, "totalPages": 5 } }
```

### Staff (admin only)

```http
GET    /admin/staff
POST   /admin/staff          { "name", "username", "password", "email", "phone", "role" }
PUT    /admin/staff/:id
DELETE /admin/staff/:id
```

### Note on this repository

This repository currently holds the **admin dashboard** only. The customer-facing frontend
(QR Scan → Table → Menu → Cart → Order → Payment → Verification) and the Node/Express
backend are separate projects and are not included here. Both apps depend on the API
contract below, so they can be connected later without changing page code.

### Response envelope

List endpoints may return a bare array, `{ "data": [...] }`, or a named key such as `{ "orders": [...] }` —
all three are unwrapped automatically by `src/lib/api.ts`. Paginated endpoints should include
`meta: { page, limit, total, totalPages }`.

### Errors

```json
{ "message": "Invalid credentials" }
{ "message": "Validation failed", "errors": { "username": "Required" } }
```

Non-2xx responses surface the backend's `message` field. Network failures show a
"Cannot reach the server" state rather than a blank screen.

## Project structure

```
src/
  App.tsx                    routes + role guards
  config.ts                  restaurant name, storage keys
  lib/
    api.ts                   fetch wrapper, error handling, response unwrapping
    endpoints.ts             every backend call in one place
    permissions.ts           role → permission map
    orderStatus.ts           status flow, labels, colours
    format.ts                INR currency, dates
  hooks/queries.ts           TanStack Query hooks + optimistic status update
  providers/AuthProvider.tsx session state
  components/                layout, order card, timeline, UI primitives
  pages/                     one file per screen
  types/                     shared TypeScript types
```

## Connecting this later

1. Implement the endpoints above in the Express backend.
2. Set `VITE_API_BASE_URL` (dev: point `VITE_PROXY_TARGET` at the backend port).
3. The field names in `src/types/index.ts` must match the backend response, or adjust the
   `unwrap`/mapping in `src/lib/api.ts` and `src/lib/endpoints.ts` — no page changes needed.
