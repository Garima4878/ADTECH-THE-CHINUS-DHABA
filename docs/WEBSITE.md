# Customer website (`index.html`, `app.js`, `styles.css`)

> Part of the Chinu Family Restaurant & Dhaba project. See the [project README](../README.md) for how all the parts fit together.

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

To show the AI menu chat button, also set `aiAssistantUrl` to the AI service (see `ai-assistant/README.md`), e.g. `aiAssistantUrl: "http://localhost:4001"`. "Add" in the chat adds the dish to this cart.

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
