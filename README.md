# Chinu Family Restaurant & Dhaba

Responsive restaurant site and QR-ordering frontend prototype. Open `index.html` in a browser, or serve this folder with any static web server. The sample menu and browser-only orders are labelled as demo mode; they are not a live restaurant menu or payment service.

## QR table ordering

Give each table a unique URL such as `https://restaurant.example/?table=T01` and print that URL into its QR code. The frontend recognizes `table`, `tableId`, and `t` query parameters, displays the table, and sends its identifier with the order. Keep table IDs stable and validate them on the server.

## Backend connection

Set `apiBaseUrl` and `onlinePayments` in `config.js` for the deployment. For example:

```js
window.CHINU_CONFIG = {
  apiBaseUrl: "https://api.example.com",
  onlinePayments: true
};
```

Only use a public API origin here. Do not put payment gateway secrets, private API credentials, or privileged staff tokens in frontend code. Staff endpoints must enforce authentication and authorization on the server; this UI does not provide staff authentication.

The frontend expects these JSON contracts (adapt the frontend or the backend to the team's agreed contract before deployment):

- `GET /api/menu` returns an array of items or `{ "items": [...] }`. Each item has `id`, `name`, numeric `price`, optional `description`, `category`, `tag`, `imageUrl` (or `image`), and boolean `available`.
- `POST /api/orders` receives `{ tableId, channel, customer: { name, phone, note }, paymentMethod, items: [{ menuItemId, quantity }], clientSubtotal }`. The server must recheck item availability and calculate the authoritative total; `clientSubtotal` is informational only. Return `{ id, total, status }` or `{ orderId, total, status }`.
- `GET /api/orders/{id}` returns `{ id, total, status }` for customer status polling. Supported statuses are `Pending`, `Accepted`, `Preparing`, `Ready`, and `Served` or `Completed`.
- With online payments enabled, `POST /api/payments/initiate` receives `{ orderId, returnUrl }` and returns `{ checkoutUrl }`. The backend creates the gateway session and keeps all private credentials server-side.
- The payment return URL includes `payment_return=1` and `orderId`. The frontend calls `POST /api/payments/verify` with `{ orderId, paymentReference }`; the backend must verify with the payment provider and return `{ paymentStatus, orderStatus }`. Never trust a browser redirect as proof of payment.
- The staff board uses `GET /api/staff/orders` returning an array or `{ orders: [...] }`, and `PATCH /api/staff/orders/{id}/status` with `{ status }`. Protect these routes with backend staff authorization.

API requests send cookies (`credentials: include`) and JSON. Configure appropriate CORS and secure session-cookie settings on the API. API/network failures are surfaced in the UI; the frontend does not silently substitute demo data when a live API is configured.

## Demo and known integration requirements

Without an API origin, the page uses the six example dishes from the supplied visual reference, stores cart/orders in browser local storage, and lets the prototype staff board change demo statuses. Online payment is intentionally unavailable in demo mode. Replace the sample menu with the restaurant's approved menu and actual availability before launch.

The deployment team still needs to supply the API origin/contracts, approved menu data and photos, unique table QR URLs, payment gateway return/verification behavior, and authenticated staff API. The phone number, address, opening hours, menu content, and images shown here are reference/demo content and should be confirmed before production.
# Chinu Family Restaurant & Dhaba Backend

This repository contains the backend for the Chinu Family Restaurant & Dhaba project. It is designed to power the restaurant menu, QR-based table ordering, customer orders, administrative order management, payment creation, and server-side verification.

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

- `POST /api/orders` — Create a customer order for a validated table
- `GET /api/orders` — Fetch all orders (admin/staff only)
- `GET /api/orders/pending` — Fetch pending orders
- `GET /api/orders/:id` — Fetch a single order
- `GET /api/orders/table/:tableId` — Fetch orders for a table
- `PATCH /api/orders/:id/status` — Update order status (admin/staff only)

### Payments

- `POST /api/payments/create` — Create Razorpay order from an order total
- `POST /api/payments/verify` — Verify gateway signature on the backend
- `GET /api/payments/order/:orderId` — Fetch payment details (admin/staff only)

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

This environment does not have a running MongoDB instance by default, so database-backed e2e tests must be run with a live MongoDB URI.

To run the built-in smoke tests:

```bash
node --test
```

A local smoke test verifies:

- app boots correctly
- health endpoint works
- validation middleware returns the expected error payload

For full end-to-end testing, ensure MongoDB is running and the `.env` file is configured.

## Deployment Instructions

- Set all environment variables in the deployment environment.
- Ensure the app uses `PORT` from environment values.
- Configure `CLIENT_URL` and CORS for the production frontend.
- Keep secrets in deployment secret stores, not in source control.

## Known Limitations

- This project is intentionally backend-focused and does not include a frontend redesign.
- Full order/payment flow validation depends on a working MongoDB instance and valid Razorpay credentials.
- Payment verification is implemented on the backend and must not be trusted from the client.
