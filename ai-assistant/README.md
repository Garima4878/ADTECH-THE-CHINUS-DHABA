# Chinu AI Menu Assistant

AI module for **The Chinu Family Restaurant & Dhaba** QR table-ordering website.
Owner: AI Lead Intern.

The assistant helps customers at their table find dishes, check prices and availability, and get
recommendations (chicken / mutton / egg / fish / biryani / veg, budget, lunch or dinner). It is an **add-on**:
it never places orders or handles payment, and the normal menu → cart → payment flow works with or without it.

```
Customer phone ──► Frontend (menu, cart)            ──► Backend API (menu, orders, payment)
                   └─ chat-widget.js ──► AI service ──┘ (reads live menu: price + availability)
                                         └─► Google Gemini API (free tier, server-side key only)
```

## What's in this folder

| Path | What it is |
|---|---|
| `data/restaurant-knowledge-base.json` | Approved menu + restaurant info. The only source of truth for the AI. |
| `src/server.js` | Express service: `/api/ai/chat`, `/api/ai/recommend`, `/api/ai/health` |
| `src/llmAssistant.js`, `src/prompts.js` | Gemini call + system prompt |
| `src/guardrails.js` | Checks every AI reply (prices, offers, off-menu dishes) before a customer sees it |
| `src/offlineAssistant.js`, `src/intent.js` | Rule-based answers: used with no API key, and whenever the AI fails or is rejected |
| `src/recommender.js` | Deterministic recommendation logic |
| `public/chat-widget.js` | Drop-in chat widget for the frontend (no dependencies) |
| `public/demo.html` | Demo menu page showing the widget working |
| `tests/` | 40 automated tests (`npm test`) |
| `docs/AI_DESIGN_AND_TESTING.md` | Prompt, model, guardrails, limitations and test cases |

## Setup

Requires Node.js 20+.

```bash
cd ai-assistant
npm install
cp .env.example .env      # then edit .env
npm start                 # http://localhost:4001  →  demo at http://localhost:4001/demo
npm test
```

| Variable | Required | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | No | Free Gemini key from [aistudio.google.com/apikey](https://aistudio.google.com/apikey). **Empty = offline mode** (rule-based answers). Server-side only. |
| `GEMINI_MODEL` | No | Default `gemini-3.5-flash-lite` (free tier) |
| `MENU_API_URL` | No | Backend menu endpoint for live price/availability. Empty = local JSON only. |
| `ALLOWED_ORIGINS` | No | Comma-separated frontend URLs allowed to call the service. `*` for local dev only. |
| `PORT` | No | Default `4001` |

Never commit `.env`. The API key must never appear in frontend code: the widget only talks to this service.

## API

### `POST /api/ai/chat`

```json
// request
{ "message": "anda biryani milega?", "tableId": "5",
  "history": [{ "role": "user", "content": "hi" }, { "role": "assistant", "content": "Namaste!..." }] }

// response 200
{
  "reply": "Yes, Egg Biryani is available.",
  "items": [{ "id": "egg-biryani", "name": "Egg Biryani", "name_hi": "अण्डा बिरयानी", "category": "biryani",
              "price": null, "price_status": "ask_staff", "is_veg": false, "available": true }],
  "needs_staff": false,
  "source": "ai"          // "ai" or "offline"
}
```

- `message`: required, max 500 characters. `tableId`: optional, `[A-Za-z0-9_-]{1,20}`. `history`: optional, last 6 turns are used.
- `items`: dishes mentioned in the reply, so the UI can show **Add to cart** buttons. Only available items are returned.
- `needs_staff: true` means the customer should ask the counter (booking, complaints, payment, unknown questions).
- Errors: `400` invalid input, `429` more than 20 messages/minute from one IP, `500` service error (the widget shows a friendly fallback).

### `POST /api/ai/recommend`

Structured recommendations without free text, e.g. for a "Suggest for me" button.

```json
// request (all fields optional)
{ "preference": "mutton", "budget": 300, "mealType": "dinner", "vegOnly": false, "limit": 3 }
// preference: chicken | mutton | egg | fish | biryani | thali | roti | veg
// mealType:   lunch | dinner | snack

// response 200
{ "items": [ ...same item shape as above... ], "over_budget_count": 0,
  "note": "Some prices are not listed in the app yet - please confirm with the staff that they fit your budget." }
```

### `GET /api/ai/health`

`{ "status": "ok", "mode": "ai" | "offline", "kb_version": "0.1.0-draft", "items": 16, "live_menu": false }` for DevOps health checks.

### `GET /api/ai/knowledge-base`

The public menu data (no secrets). Useful to the frontend team while the backend menu API is being built.

## Integration plan

### Frontend (Basic + Intermediate Frontend interns)

Add one script tag to the customer menu page:

```html
<script src="https://<ai-service-url>/widget/chat-widget.js"
        data-api-base="https://<ai-service-url>"
        data-bottom-offset="80"
        defer></script>
```

- **Table number**: the widget reads `?table=` from the page URL (the QR link), or use `data-table-id="5"`, or call `window.ChinuAI.setTableId('5')`.
- **Add to cart**: the widget does not touch the cart. It fires an event; the frontend adds the item with its own cart logic:

  ```js
  window.addEventListener('chinu:add-to-cart', (e) => addToCart(e.detail.itemId));
  ```
- **Doesn't block ordering**: a small floating button. On phones it opens as a bottom sheet that the customer can close with × or Esc, and the menu and cart stay usable.
- `data-bottom-offset` lifts the button above a sticky cart bar (px).
- Optional: `window.ChinuAI.ask('Suggest chicken for dinner')` opens the chat with a question, e.g. from a "Need help choosing?" link.
- React: load the script once (e.g. in `index.html`) and listen for `chinu:add-to-cart` in a `useEffect`.

### Backend (Backend + Fullstack interns)

1. **Connect the live menu**: set `MENU_API_URL` to the team backend's menu route, e.g.
   `MENU_API_URL=http://localhost:5000/api/menu` (deployed: `https://<backend-url>/api/menu`).
   It reads the backend's response as-is:

   ```json
   { "success": true, "data": { "menu": [{ "_id": "66f1…", "name": "Chicken Biryani", "price": 220, "isAvailable": true, "category": { "name": "Biryani" } }] } }
   ```

   A plain array or `{ "items": [...] }` with `id` / `available` also works.
2. **Dish matching**: backend dishes are matched to the knowledge base by **dish name** (the backend uses MongoDB ids), so please
   use the same dish names as `data/restaurant-knowledge-base.json` (e.g. "Chicken Biryani", "Mutton Paya Korma") when seeding the menu.
   Backend dishes with other names are still added, so the AI can talk about them.
3. Backend price and availability override the local file (cached 60 s), so the AI never suggests a sold-out dish.
   If the backend is down, the AI falls back to the local file and logs a warning.
4. **Add to cart**: when the live menu is connected, the chat's `chinu:add-to-cart` event sends the backend `_id` as
   `detail.itemId` (our knowledge-base id is in `detail.aiItemId`), so the cart can pass it straight to `POST /api/orders`.
5. Prices shown by the AI are for guidance only. **Order totals are always calculated by the backend.**

### DevOps

- Deploy as a separate Node service (`npm start`). Health check: `GET /api/ai/health`.
- Secrets: `GEMINI_API_KEY` in the host's environment settings, never in the repo.
- Set `ALLOWED_ORIGINS` to the deployed frontend URL and `MENU_API_URL` to the deployed backend.
- Logs: lines starting with `[ai]` show AI failures, rejected replies and live-menu problems.

## Status and open items

- [ ] **Prices are estimates**: all 16 prices were estimated by the team from typical small-town dhaba prices in Madhya Pradesh (Oct 2026) so the prototype is usable. Replace them with the restaurant-approved price list before launch (or load the real prices into the backend: the AI picks them up through `MENU_API_URL`).

  | Dish | ₹ | Dish | ₹ | Dish | ₹ |
  |---|---|---|---|---|---|
  | Chicken Biryani | 160 | Chicken Handi | 240 | Fish Roast | 220 |
  | Mutton Biryani | 240 | Mutton Handi | 320 | Special Thali | 200 |
  | Egg Biryani | 120 | Mutton Korma | 300 |  |  |
  | Special Biryani | 200 | Mutton Paya Korma | 260 | Jowar Roti | 20 |
  | Chicken Roast | 200 | Special Chicken & Mutton Korma | 350 | Bajra Roti | 20 |
  | Chicken Fry | 180 | | | Makka Roti | 25 |
- [ ] **Restaurant details**: address, phone and opening hours are not in the photos (`null`).
- [ ] **Descriptions**: short neutral descriptions were written for each dish. The team needs to review them.
- [ ] **Item ids**: must be agreed with the backend.
- [x] **Live AI test** (2026-09-29): `gemini-3.5-flash-lite` answered 6 test questions correctly (English + Hinglish, off-menu dish, unknown price, booking → staff). Re-run the full list in the docs after the prices are added.
