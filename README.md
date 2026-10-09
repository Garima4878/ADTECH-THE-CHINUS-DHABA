# The Chinu Family Restaurant & Dhaba: QR table ordering

Digital ordering for **The Chinu Family Restaurant & Dhaba**, Multai (Madhya Pradesh), "The Nonveg King of Multai".
Customers scan the QR code on their table, browse the menu, ask the AI menu assistant, order and pay from their phone.
Staff see and update the orders on the restaurant dashboard, and the customer sees the status change.

```
QR scan → table identified → menu → cart → order → payment → payment verification
        → order confirmation → restaurant dashboard → order status update (customer sees it)
```

Built by the AD Tech Enterprises intern team.

## The four parts

| Part | Folder | What it is | Tech | Details |
|---|---|---|---|---|
| **Customer website** | repository root: `index.html`, `app.js`, `styles.css`, `config.js`, `assets/`; animations in `effects.css` / `effects.js` | Menu, cart, checkout, online payment, order tracking. Phone-first, animated (switched off for visitors who prefer reduced motion). | HTML, CSS, JavaScript (no build step) | [docs/WEBSITE.md](docs/WEBSITE.md) |
| **Backend API** | `server.js`, `src/`, `scripts/`, `test/` | Menu, tables, orders, payments (Razorpay), staff login, admin API | Node.js, Express, MongoDB, Razorpay | [docs/BACKEND.md](docs/BACKEND.md) |
| **AI menu assistant** | `ai-assistant/` | Chat button on the website: answers menu questions (English/Hindi/Hinglish) and recommends dishes, only from the real menu | Node.js, Express, Google Gemini | [ai-assistant/README.md](ai-assistant/README.md) |
| **Restaurant admin dashboard** | `admin-dashboard/` | Staff login, live orders, kitchen screen, menu, tables, payments, staff accounts | React, TypeScript, Vite | [admin-dashboard/README.md](admin-dashboard/README.md) |

Also in the repository: `assets/photos/` (the restaurant's original photos), `assets/menu/` and `assets/site/` (photos used on the website, cut from those originals), and `prototypes/aadya-react-frontend/` (an early React prototype of the website, kept for reference).

### How they connect

```
 Customer's phone                                   Restaurant staff
 ┌──────────────────────┐                          ┌──────────────────────────┐
 │ Customer website     │                          │ Admin dashboard          │
 │ (?table=T05 from QR) │                          │ (login: admin/manager/   │
 │   └─ AI chat button ─┼──► AI assistant          │  employee)               │
 └──────────┬───────────┘     (ai-assistant/)      └────────────┬─────────────┘
            │ /api/menu, /api/orders,   │ reads /api/menu          │ /api/admin/...
            │ /api/payments             ▼                          │
            └─────────────────────►  Backend API  ◄────────────────┘
                                     (server.js) ──► MongoDB
                                         └────────► Razorpay (payment links)
```

- The **menu** (16 dishes, names and prices) comes from one file, `ai-assistant/data/restaurant-knowledge-base.json`. `npm run seed` loads it into the database, and the website and the AI read the same dishes from the backend.
- The **table number** comes from the QR link (`?table=T05`) and travels with the order to the dashboard.
- **Totals and payments are checked on the server**: the browser's prices are never trusted, and Razorpay is asked directly whether an order was paid.

## Run everything on one PC (`npm run demo`)

Needs Node.js 20 or newer. No database install needed.

```bash
npm install
(cd ai-assistant && npm install)
(cd admin-dashboard && npm install)
cp .env.example .env          # optional: add Razorpay test keys, see below
npm run demo
```

The demo prints the links:

| What | Link |
|---|---|
| Customer website (table 5) | http://localhost:8080/?table=T05 |
| Same, from a phone on the same Wi-Fi | `http://<PC's Wi-Fi address>:8080/?table=T05` (printed by the demo) |
| Admin dashboard | http://localhost:5173, login `admin` / `SEED_ADMIN_PASSWORD` from `.env` (default `chinu-admin-2026`) |
| Backend health check | http://localhost:5000/api/health |

- **Database:** the MongoDB in `MONGODB_URI` if it's running, otherwise a temporary in-memory one. Orders are cleared when the demo stops.
- **AI chat:** works without a key (rule-based answers). Add `GEMINI_API_KEY` to `ai-assistant/.env` for AI answers.
- **Online payment:** on when Razorpay **test** keys (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`) are in `.env`. Pay with UPI ID `success@razorpay` (or `failure@razorpay` to try a failed payment). Test mode never moves real money.
- If a phone can't open the site, allow Node.js through Windows Firewall for private networks.
- Stop everything with **Ctrl+C**.

## Run the parts separately (development)

| Part | Commands | Notes |
|---|---|---|
| Backend | `npm install` → `cp .env.example .env` → `npm run seed` → `npm run dev` | needs MongoDB (`MONGODB_URI`), port 5000 |
| Website | serve the repository root with any static server, e.g. `npx serve .` | set `apiBaseUrl`, `onlinePayments` and `aiAssistantUrl` in `config.js`. With an empty `apiBaseUrl` it runs in demo mode (browser-only orders). |
| AI assistant | `cd ai-assistant` → `npm install` → `cp .env.example .env` → `npm start` | port 4001. Set `MENU_API_URL=http://localhost:5000/api/menu` for live prices and availability. |
| Admin dashboard | `cd admin-dashboard` → `npm install` → `npm run dev` | port 5173, proxies `/api` to `VITE_PROXY_TARGET` (default `http://localhost:5000`) |

## Table QR codes (`npm run qr`)

```bash
npm run qr -- https://<website-address>             # tables T01-T10
npm run qr -- https://<website-address> --tables 12
```

This creates `qr-codes/T01.png`, `qr-codes/T02.png` and so on, plus `qr-codes/print.html`: A4 cut-out cards with the restaurant name, "Scan to see the menu & order" and the table number. Each code opens `https://<website-address>/?table=T01` (etc.), matching the tables created by `npm run seed`. Make them once the website is online, and scan one with a phone before printing. For phone testing with `npm run demo`, use the Wi-Fi address it prints. `qr-codes/` is git-ignored.

## Tests

```bash
npm test                                   # backend + AI assistant (62 tests, in-memory MongoDB, fake Razorpay)
(cd admin-dashboard && npm run typecheck && npm run build)
```

## Configuration and secrets

Every part has a `.env.example`. Copy it to `.env` and fill it in. **`.env` files are git-ignored: never commit keys or passwords, and never paste them into chats.**

| Setting | Where | Purpose |
|---|---|---|
| `MONGODB_URI`, `JWT_SECRET` | root `.env` | database, staff login tokens |
| `CLIENT_URL` | root `.env` | website + dashboard URLs (comma-separated): CORS and allowed payment return pages |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | root `.env` | online payment (test keys for now) |
| `SEED_ADMIN_USERNAME`, `SEED_ADMIN_PASSWORD` | root `.env` | first dashboard admin, created by `npm run seed` |
| `GEMINI_API_KEY`, `MENU_API_URL`, `ALLOWED_ORIGINS` | `ai-assistant/.env` | AI answers, live menu, website URL |
| `apiBaseUrl`, `onlinePayments`, `aiAssistantUrl` | `config.js` | where the website finds the backend and the AI |
| `VITE_API_BASE_URL` | `admin-dashboard/.env` | backend `/api` URL for the built dashboard |

## Deployment checklist

Free hosting: **MongoDB Atlas** (database), **Render** (backend + AI, from `render.yaml`), **Netlify** (website from `netlify.toml`, dashboard from `admin-dashboard/netlify.toml`). Secrets go only into the hosting dashboards, never into the repo.

1. **Database:** MongoDB Atlas free (M0) cluster, a database user, Network Access `0.0.0.0/0`. Connection string ends in `/chinu_dhaba`.
2. **Backend + AI:** Render → New → Blueprint → this repository. Fill in `MONGODB_URI`, `RAZORPAY_KEY_ID/SECRET`, `GEMINI_API_KEY`, `MENU_API_URL` (`https://<api>.onrender.com/api/menu`). Leave `CLIENT_URL` / `ALLOWED_ORIGINS` until step 5. Health checks: `/api/health`, `/api/ai/health`.
3. **Seed the live database once from your PC** (Render free has no shell):
   ```powershell
   $env:MONGODB_URI="<atlas connection string>"; $env:SEED_ADMIN_PASSWORD="<strong password>"; npm run seed
   ```
4. **Website:** Netlify → import this repository (base directory: repo root). Environment variables: `CHINU_API_URL`, `CHINU_AI_URL`, `CHINU_ONLINE_PAYMENTS=true`, and optionally `CHINU_ADMIN_URL` (dashboard URL: adds a "Restaurant staff" link to the footer). The build (`npm run build:website`) publishes only the website files and writes `config.js`.
   **Dashboard:** a second Netlify site with base directory `admin-dashboard` and `VITE_API_BASE_URL=https://<api>.onrender.com/api`.
5. On Render set `CLIENT_URL` = website URL + dashboard URL (comma-separated) and `ALLOWED_ORIGINS` = website URL.
6. Make and print the QR codes with the live website URL (`npm run qr -- https://<website>`).
7. **Smoke test:** scan a QR code with a phone → order → pay in test mode → see it on the dashboard → update the status → see it on the phone.

Render free services sleep after ~15 minutes idle; the first request afterwards takes up to a minute.

**Prototype mode (no dashboard login):** set `PROTOTYPE_OPEN_ADMIN=true` on the Render backend and `VITE_PROTOTYPE_NO_LOGIN=true` on the dashboard's Netlify site, then redeploy both. Anyone with the dashboard link then has full admin access (orders, customer phone numbers, prices, staff), so remove both variables before the restaurant uses it for real.

## Status and known gaps

- **Prices:** all 16 prices are team estimates until the restaurant confirms them.
- **Contact details:** the opening hours and phone number on the website are placeholders. The exact address isn't known yet.
- **Payments:** Razorpay **test mode** only. Live payments need the restaurant's own Razorpay account.
- **Order types:** dine-in only. Takeaway/delivery and partial/refunded payments appear in the dashboard UI but aren't produced yet.
