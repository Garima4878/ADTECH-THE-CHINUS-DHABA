# AI Design, Prompts and Testing

## 1. Model and API

| | |
|---|---|
| Provider | Google Gemini API (free tier), official Node SDK `@google/genai` |
| Model | `gemini-3.5-flash-lite` (configurable with `GEMINI_MODEL`). Fast, free tier, suited to short chat answers. |
| Cost | ₹0 on the free tier. The free tier has per-minute and per-day request limits. When they are hit, the assistant switches to offline answers automatically. |
| Output | Structured JSON (`responseMimeType: application/json` + JSON schema): `{ reply, item_ids, needs_staff }` |
| Temperature | 0.3: factual menu answers |
| Safety blocks | A blocked or cut-off reply switches to the offline answer. |
| Timeout | 15 s. On any failure the customer gets the offline answer, never an error. |
| Key handling | `GEMINI_API_KEY` read from the server environment only. The browser never sees it. |
| Data use | On the free tier Google may use prompts to improve its products. Only public menu data and customer questions are sent. Don't send personal data. |

## 2. How a question is answered

```
customer message
  │
  ├─ API key set? ── no ──────────────────────────────────────────┐
  │     yes                                                        │
  ▼                                                                ▼
Gemini (system prompt = rules + full menu JSON)           Offline assistant (rules)
  │                                                                ▲
  ▼                                                                │
Guardrails ── reply fails a check ─────────────────────────────────┘
  │ passes
  ▼
reply + dish cards (only available items) → widget
```

### Guardrails (`src/guardrails.js`)

Every AI reply is checked before a customer sees it. If any check fails, the offline answer is used instead:

1. **Prices**: every price in the reply (₹180, Rs 180, 180/-) must be a real menu price or a number the customer typed (e.g. their budget).
2. **Offers**: mentions of discounts, % off, combos or coupons are rejected while the knowledge base has no offers.
3. **Off-menu dishes**: common dishes not on this menu (butter chicken, paneer, tandoori, naan…) are rejected unless the customer asked about them. If they did ask, the reply is allowed so the model can say "we don't have it".
4. **Item ids**: unknown or unavailable ids are removed, so an "Add to cart" button can never appear for a dish that doesn't exist or is sold out.

### Fallback behaviour

When the assistant can't answer from the menu data, it never guesses. It replies:

> I'm not sure about that. Please check the Menu tab or ask our staff at the counter.

(Hindi version for Hindi questions) and sets `needs_staff: true`. The same happens for bookings, complaints, bill/payment and order-status questions.

## 3. System prompt

Built in `src/prompts.js`. The full menu JSON (id, names, category, price, availability, veg flag, meal type, description), restaurant info and offers are appended after the rules below.

```
You are the menu assistant for The Chinu Family Restaurant & Dhaba in Multai, shown inside the restaurant's
QR table-ordering website. Customers are sitting at their table and reading your replies on a phone.

Answer only from the MENU DATA below. It is the complete, approved menu and restaurant information.
- Mention only dishes that are in the menu data, using their exact names. If a customer asks for a dish that
  isn't there, say we don't have it and suggest the closest dish we do have.
- State a price only when the item's "price" is a number. When it is null, say the price isn't listed in the
  app yet and the staff can confirm it. Never estimate or round a price.
- Never recommend an item whose "available" is false. You may say it is not available right now.
- Do not invent offers, discounts, combos, timings, phone numbers, spice levels, portion sizes or ingredients
  beyond the description. If "offers" is empty, there are no offers.
- For recommendations, use what the customer tells you (chicken, mutton, egg, fish, biryani, veg, budget,
  lunch or dinner) and pick from available items. If they give a budget, only name priced items within it,
  or clearly say the price must be confirmed with staff.
- If the question can't be answered from the menu data (bookings, complaints, bill or payment problems, order
  status, delivery, anything else), set needs_staff to true and point them to the Menu tab or the staff.
- You cannot place orders or take payment. To order, the customer taps "Add to cart" on a dish.
- Reply in the customer's language: English, Hindi or Hinglish. Keep replies under 60 words. No markdown.
- item_ids: the ids of the dishes you recommend or directly talk about, most relevant first, at most 4.
```

The table number is sent in the user message (`[Customer at table 5] ...`), not the system prompt, so the system prompt is the same for every table.

## 4. Recommendation logic (`src/recommender.js`)

Deterministic, so it works without AI and can't invent anything:

1. Keep only **available** items matching the preference (category, main ingredient, dish name, or veg).
2. With a **budget**: drop items with a known price above it. Items with no listed price are kept but flagged "confirm with staff".
3. Rank: items with a confirmed price first when a budget is given, then meal-type match, then the house "Special" dishes advertised on the restaurant's banners.
4. Return the top 3 (configurable) plus a note when prices need confirming.

## 5. Offline assistant (`src/offlineAssistant.js`)

Understands English, Hindi (Devanagari) and Hinglish (`anda`, `machli`, `murga`, `kitne ka`, `milega`, `ke andar`).
Intents: greeting, dish info, price, availability, recommendation, menu/category listing, wait time, contact,
order/payment help, and unknown → fallback.

## 6. Test cases and expected responses

Automated: `npm test` (36 tests: knowledge base, parsing, recommender, guardrails, assistant, HTTP API).
The offline answers below were run against the current knowledge base. AI-mode answers will be worded differently, but must pass the same guardrails.

| # | Customer asks | Expected behaviour (verified in offline mode) |
|---|---|---|
| 1 | `hi` | Welcome message with example questions |
| 2 | `suggest chicken for dinner` | 3 available chicken dishes, plus a note that some prices need confirming |
| 3 | `biryani under 200` | Available biryanis. Prices not listed → "please confirm with staff that they fit your budget". No invented prices. |
| 4 | `anda biryani milega?` | "Yes, Egg Biryani is available." + Add button |
| 5 | `veg thali kitne ka hai` | "Veg Thali: ₹100" |
| 6 | `mutton paya korma price` | "price not listed - please ask staff", `needs_staff: true` |
| 7 | `चिकन हाण्डी` | Chicken Handi description, availability, price status |
| 8 | `do you have butter chicken?` | "Sorry, butter chicken is not on our menu." + our chicken dishes |
| 9 | `show mutton dishes` | List of available mutton dishes |
| 10 | `kitna time lagega` | "around 15 minutes" (from the restaurant's notice board) |
| 11 | `where is the restaurant` | Name + Multai; other details → ask staff |
| 12 | `can I book a table for 10 people` | Fallback to Menu tab / staff, `needs_staff: true` |
| 13 | AI replies "Chicken Handi is ₹220" (not a menu price) | Rejected by guardrail → offline answer shown |
| 14 | AI reply mentions "20% off" | Rejected: no offers exist |
| 15 | AI call fails / times out | Offline answer shown, no error for the customer |
| 16 | Backend marks Chicken Biryani `available: false` | Never recommended. The Add button is not shown. |

### Manual test (widget)

1. `npm start`, open `http://localhost:4001/demo?table=5` on a phone (same Wi-Fi: use the PC's IP) or in browser dev tools' mobile view.
2. Header shows **Table 5**. Tap **Ask Chinu AI** and try the chips and the questions above.
3. Tap **Add** on a dish card: the demo cart bar count increases.
4. Close with × and confirm the menu and cart are still usable.

## 7. Limitations

- **Prices**: only Veg Thali has a price in the supplied photos. Budget recommendations are limited until the approved price list is added.
- **Descriptions** are short neutral text written from the dish names and banner photos. They don't cover spice level or portion size, and the assistant won't claim those.
- **Off-menu detection** uses a fixed list of common dishes. The model could still name a rarer dish that isn't on the menu. The prompt forbids it, and item ids are always filtered, so no Add button can appear for it.
- **Offline mode** is keyword-based. Unusual phrasing gets the safe fallback instead of an answer.
- **No memory across sessions**. The widget sends only the current conversation (last 6 turns).
- **Free-tier limits**: heavy use can hit Gemini free-tier limits. Customers then get offline answers until the limit resets.
- **Live AI testing is partial**. On 2026-09-29 six questions were checked against the real Gemini model, and all passed:
  - "suggest chicken for dinner": 4 chicken dishes, price to be confirmed with staff
  - "anda biryani milega?": "Haan, Egg Biryani available hai!…" (answered in Hinglish)
  - "do you have butter chicken?": "We don't have butter chicken, but you can try our Chicken Handi or Chicken Roast."
  - "veg thali kitne ka hai": "Veg Thali ki keemat 100 rupees hai."
  - "mutton handi price?": price not listed, staff can confirm
  - "can I book a table for 10?": points to staff, `needs_staff: true`

  The automated tests use a mocked model.
