# Backend API (`server.js`, `src/`)

> Part of the Chinu Family Restaurant & Dhaba project. See the [project README](../README.md) for how all the parts fit together.

This part of the repository is the backend for the Chinu Family Restaurant & Dhaba project. It is designed to power the restaurant menu, QR-based table ordering, customer orders, administrative order management, payment creation, and server-side verification.

## Project Overview

The system supports:

- Menu and category APIs
- QR/table validation for dine-in ordering
- Server-side order creation and total calculation
- Order status lifecycle management
- Razorpay payment initiation and verification
- Authentication and authorization for admin/staff routes
- MongoDB-backed persistence for menu, orders, tables, and payments

## Tech Stack

- Node.js
- Express.js
- MongoDB + Mongoose
- JWT authentication
- Express Validator
- Razorpay integration
- Helmet + CORS

## Architecture

- `server.js` starts the server and connects to MongoDB
- `src/app.js` configures the Express app and routes
- `src/config` stores DB and payment configuration
- `src/models` contains the MongoDB schemas
- `src/controllers` contains business logic
- `src/routes` contains route definitions
- `src/middleware` contains validation and auth/error handling
- `src/utils` contains response and API helpers

## Folder Structure

```text
.
├── README.md
├── .env.example
├── .gitignore
├── package.json
├── server.js
├── src/
│   ├── app.js
│   ├── config/
│   │   ├── db.js
│   │   └── razorpay.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── categoryController.js
│   │   ├── menuController.js
│   │   ├── orderController.js
│   │   ├── paymentController.js
│   │   └── tableController.js
│   ├── middleware/
│   │   ├── authMiddleware.js
│   │   ├── errorMiddleware.js
│   │   └── validate.js
│   ├── models/
│   │   ├── Category.js
│   │   ├── MenuItem.js
│   │   ├── Order.js
│   │   ├── Payment.js
│   │   ├── Table.js
│   │   └── User.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── categoryRoutes.js
│   │   ├── menuRoutes.js
│   │   ├── orderRoutes.js
│   │   ├── paymentRoutes.js
│   │   └── tableRoutes.js
│   └── utils/
│       ├── ApiError.js
│       └── apiResponse.js
└── test/
    └── app.test.js
```

## Environment Variables

Use the variables shown in `.env.example` and fill them with your own values:

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/chinu_dhaba
CLIENT_URL=http://localhost:3000
JWT_SECRET=your_jwt_secret_here
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
```

Do not commit real secrets. The repository already keeps `.env` ignored via `.gitignore`.

## Installation

To run the whole project at once (backend, website, AI chat and dashboard), use `npm run demo`, see the [project README](../README.md). The table QR codes (`npm run qr`) are described there too.


```bash
npm install
cp .env.example .env
npm run dev
```

## MongoDB Setup

1. Install MongoDB locally or use a MongoDB Atlas cluster.
2. Set `MONGODB_URI` in the `.env` file.
3. Ensure the server is reachable before starting the app.

## Running the Backend

```bash
npm run dev
```

The API is available at:

```text
http://localhost:5000/api
```

## API Documentation

### Authentication

- `POST /api/auth/register` — Create admin/staff user
- `POST /api/auth/login` — Login and receive JWT token
- `GET /api/auth/me` — Fetch current authenticated user

### Categories

- `GET /api/categories` — Fetch all categories
- `GET /api/categories/:id` — Fetch a single category
- `POST /api/categories` — Create a category (admin/staff only)
- `PUT /api/categories/:id` — Update a category (admin/staff only)
- `DELETE /api/categories/:id` — Delete a category (admin/staff only)

### Menu

- `GET /api/menu` — Fetch menu items
- `GET /api/menu/:id` — Fetch single menu item
- `POST /api/menu` — Create a menu item (admin/staff only)
- `PUT /api/menu/:id` — Update a menu item (admin/staff only)
- `PATCH /api/menu/:id/availability` — Toggle item availability (admin/staff only)
- `DELETE /api/menu/:id` — Delete a menu item (admin/staff only)

### Tables and QR Validation

- `GET /api/tables` — Fetch all tables (admin/staff only)
- `GET /api/tables/validate/:tableId` — Validate a QR/table ID
- `POST /api/tables` — Create a table (admin/staff only)
- `PUT /api/tables/:id` — Update a table (admin/staff only)

### Orders

- `POST /api/orders` — Create a customer order for a validated table (items as `itemId` or the website's `menuItemId`)
- `GET /api/orders` — Fetch all orders (admin/staff only)
- `GET /api/orders/pending` — Fetch pending orders
- `GET /api/orders/ORD-...` — Customer order tracking by Order ID, no login (status, total, payment status only)
- `GET /api/orders/:id` — Fetch a single order by MongoDB id (admin/staff only)
- `GET /api/orders/table/:tableId` — Fetch orders for a table
- `PATCH /api/orders/:id/status` — Update order status (admin/staff only)

### Payments

- `POST /api/payments/create` — Create Razorpay order from an order total (Razorpay Checkout popup)
- `POST /api/payments/initiate` — `{ orderId, returnUrl }` → `{ checkoutUrl }`: a Razorpay Payment Link for the server-side order total (hosted checkout used by the customer website). `returnUrl` must be on a `CLIENT_URL` origin.
- `POST /api/payments/verify` — With `signature`: verifies the Razorpay Checkout signature. With only `{ orderId }`: asks Razorpay for the Payment Link status and marks the order paid only if the full amount was captured.
- `GET /api/payments/order/:orderId` — Fetch payment details (admin/staff only)

### Customer website compatibility

The customer website (`index.html` / `app.js`) reads a flat JSON shape. These responses keep the usual `{ success, message, data }` and add top-level fields for it:

- `GET /api/menu` adds `items: [{ id, name, description, price, category, imageUrl, available }]`
- `POST /api/orders` and `GET /api/orders/ORD-...` add `{ orderId, status, total, subtotal, tax, paymentStatus, tableId, createdAt }`, with `Served/Completed` shown as `Served`
- `POST /api/payments/initiate` adds `checkoutUrl`; `POST /api/payments/verify` adds `{ paymentStatus, orderStatus }`

The website's own "Staff board" button (demo only) calls `/api/staff/orders` without a login and is not served. Restaurant staff use the admin dashboard below.

### Admin dashboard API (`/api/admin`)

Used by the restaurant dashboard in `admin-dashboard/` (contract in `admin-dashboard/README.md`). Every route needs a staff login: `POST /api/auth/login` with `{ username, password }` (or `{ email, password }`) returns a JWT for `Authorization: Bearer ...`. Roles are enforced by the server:

| Routes | staff (dashboard "employee") | manager | admin |
|---|:---:|:---:|:---:|
| `GET /dashboard/stats`, `GET /orders`, `GET /orders/:id` | ✅ | ✅ | ✅ |
| `PATCH /orders/:id/status` (advance), `PATCH /orders/:id/payment` (mark paid at the counter) | ✅ | ✅ | ✅ |
| Cancel an order (only before Preparing) | ❌ | ✅ | ✅ |
| `GET /menu/items`, `GET /menu/categories`, `GET /tables` | ✅ | ✅ | ✅ |
| Create/edit/delete menu items, categories and tables; table floor status | ❌ | ✅ | ✅ |
| `GET /payments` | ❌ | ✅ | ✅ |
| `/staff` (create, edit, deactivate staff accounts) | ❌ | ❌ | ✅ |

- Status changes from the dashboard and the staff API are written to the order's `statusHistory` (who and when), and customers see them on the website's order tracking.
- Safe deletes: dishes that appear in orders, categories with dishes, and tables with orders can't be deleted. Mark them unavailable or inactive instead.
- Admins can't deactivate, demote or delete their own account.
- `POST /api/auth/register` is **admin only**. It used to be public and gave every new account the admin role.

### Seed data

```bash
npm run seed
```

Loads the 16 dishes and 6 categories from `ai-assistant/data/restaurant-knowledge-base.json` (the same menu the website and AI use) and tables `T01`–`T10` (`SEED_TABLES=15` for more). QR link for a table: `https://<website>/?table=T01`. Set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` to also create an admin login. Running it again updates the same records.

## QR Table Ordering Flow

1. A QR code contains a table identifier.
2. The frontend sends the table ID to `GET /api/tables/validate/:tableId`.
3. The backend validates it against the Table collection.
4. The customer views the menu for that table.
5. The customer creates an order using the table ID.
6. The server validates item availability, price, and quantity.
7. The total is recalculated server-side.

## Order Status Flow

```text
Pending -> Accepted -> Preparing -> Ready -> Served/Completed
                      \-> Cancelled
```

## Payment Flow

1. Customer creates an order.
2. Backend creates a Razorpay order for the exact total.
3. Client completes payment on the gateway.
4. Server verifies the payment signature securely.
5. Order is marked as `Paid` only after verification succeeds.

## Testing Instructions

```bash
npm test
```

- `test/app.test.js`: app boots, health endpoint, validation errors
- `test/website-compat.test.js`: seed, menu, orders, customer tracking, Payment Link initiate/verify, CORS.
- `test/admin-dashboard.test.js`: staff login, roles, dashboard orders/status/history, counter payments, stats, menu, categories, tables, staff accounts.

The database tests use an in-memory MongoDB (`mongodb-memory-server`, downloaded on first run) and a fake Razorpay client, so no database server or payment keys are needed.

For a live end-to-end run, ensure MongoDB is running, the `.env` file is configured, and run `npm run seed`.

## Deployment Instructions

- Set all environment variables in the deployment environment.
- Ensure the app uses `PORT` from environment values.
- Set `CLIENT_URL` to the website and admin dashboard URLs (comma-separated). It controls CORS with cookies and which pages payment can return to. If it is empty, any origin is accepted (local development only).
- Keep secrets in deployment secret stores, not in source control.

## Known Limitations

- This project is intentionally backend-focused and does not include a frontend redesign.
- Full order/payment flow validation depends on a working MongoDB instance and valid Razorpay credentials.
- Payment verification is implemented on the backend and must not be trusted from the client.
