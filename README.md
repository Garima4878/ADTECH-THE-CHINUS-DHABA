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
