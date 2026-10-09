import { normalize } from './text.js';

// Common dishes that are NOT on this menu. If the model mentions one the customer didn't ask about,
// it is inventing a dish and the reply is rejected. Terms that appear in a real menu item name are
// skipped, so this list stays safe when the backend adds dishes.
export const OFF_MENU_TERMS = [
  'paneer tikka', 'chicken tikka', 'tandoori chicken', 'butter chicken', 'tandoori', 'tikka', 'kebab', 'kabab', 'seekh', 'paneer', 'prawn', 'prawns', 'shrimp', 'crab',
  'pizza', 'burger', 'noodles', 'manchurian', 'momos', 'shawarma', 'naan', 'dal makhani', 'lollipop', 'pulao',
  'fried rice', 'keema', 'kheema', 'nihari', 'haleem', 'chicken 65', 'kadai', 'kadhai', 'dosa', 'idli',
  'fish curry', 'fish fry', 'egg curry', 'omelette', 'lassi', 'beer', 'alcohol', 'liquor',
];

const PRICE_PATTERN = /(?:₹|rs\.?|inr)\s*(\d[\d,]*)|(\d[\d,]*)\s*(?:\/-|rupees|rupaye|रुपये|rs\b)/gi;
const OFFER_PATTERN = /\d+\s*%|\bdiscount|\bcombo\b|\bbogo\b|buy\s*(?:1|one)\s*get|\bcashback\b|\bcoupon\b/i;

export function extractPrices(text) {
  const prices = [];
  for (const m of String(text).matchAll(PRICE_PATTERN)) prices.push(Number((m[1] || m[2]).replace(/,/g, '')));
  return prices;
}

/** The menu item named last in `text` (the dish a following price belongs to), or null. */
function lastDishMentioned(text, items) {
  const padded = ` ${normalize(text)} `;
  let best = null;
  let bestPos = -1;
  for (const item of items) {
    for (const name of [item.name, item.name_hi]) {
      if (!name) continue;
      const key = ` ${normalize(name)} `;
      const pos = padded.lastIndexOf(key);
      const end = pos + key.length;
      // Prefer the dish ending closest to the price; on a tie prefer the longer, more specific name.
      if (pos >= 0 && (end > bestPos || (end === bestPos && key.length > ` ${normalize(best.name)} `.length))) {
        best = item;
        bestPos = end;
      }
    }
  }
  return best;
}

/**
 * Returns the first price in the reply that doesn't belong to the dish it is written next to
 * ("Chicken Handi is ₹220" when Chicken Handi costs ₹240), or null when every price checks out.
 * A price with no dish before it must still be one of the menu's prices.
 */
export function findWrongPrice(reply, items, allowedNumbers = new Set()) {
  const menuPrices = new Set(items.filter((i) => typeof i.price === 'number').map((i) => i.price));
  let segmentStart = 0;
  for (const m of String(reply).matchAll(PRICE_PATTERN)) {
    const value = Number((m[1] || m[2]).replace(/,/g, ''));
    const dish = lastDishMentioned(reply.slice(segmentStart, m.index), items);
    segmentStart = m.index + m[0].length;
    if (allowedNumbers.has(value)) continue;
    if (dish) {
      // Allow the dish's price, or a total for a few plates ("2 Chicken Biryani = ₹320").
      const ok = typeof dish.price === 'number' && value % dish.price === 0 && value / dish.price <= 10;
      if (!ok) return { value, dish: dish.name };
    } else if (!menuPrices.has(value)) {
      return { value, dish: null };
    }
  }
  return null;
}

function containsTerm(normalizedText, term) {
  return ` ${normalizedText} `.includes(` ${normalize(term)} `);
}

/** Returns a well-known dish the text mentions that is not on this menu (e.g. "butter chicken"), or null. */
export function findOffMenuDish(text, items) {
  const textNorm = normalize(text);
  const menuNames = ` ${items.map((i) => normalize(i.name)).join(' | ')} `;
  const found = OFF_MENU_TERMS.filter((t) => containsTerm(textNorm, t) && !menuNames.includes(` ${normalize(t)} `));
  return found.sort((a, b) => b.length - a.length)[0] || null; // most specific name first
}

/**
 * Checks a model reply against the knowledge base before it is shown to a customer.
 * Returns { ok: false, reason } when the reply must be replaced by the offline answer.
 */
export function validateLlmResult(raw, kb, userMessage) {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'reply is not an object' };
  const reply = typeof raw.reply === 'string' ? raw.reply.trim() : '';
  if (!reply) return { ok: false, reason: 'empty reply' };
  if (reply.length > 1200) return { ok: false, reason: 'reply too long' };

  // 1. Every price must be the real price of the dish it is written next to. Numbers the customer
  //    typed (e.g. their budget) may be repeated.
  const userNumbers = new Set((String(userMessage).match(/\d+/g) || []).map(Number));
  const wrong = findWrongPrice(reply, kb.items, userNumbers);
  if (wrong) return { ok: false, reason: `invented price ₹${wrong.value}${wrong.dish ? ` for ${wrong.dish}` : ''}` };

  // 2. No offers or discounts unless the knowledge base lists offers.
  if (!kb.offers?.length && OFFER_PATTERN.test(reply) && !OFFER_PATTERN.test(userMessage)) {
    return { ok: false, reason: 'mentions an offer that does not exist' };
  }

  // 3. No dishes that aren't on the menu, unless the customer asked about them.
  const offMenu = findOffMenuDish(reply, kb.items);
  if (offMenu && !containsTerm(normalize(userMessage), offMenu)) {
    return { ok: false, reason: `mentions off-menu dish "${offMenu}"` };
  }

  // 4. Keep only real, available item ids.
  const availableIds = new Set(kb.items.filter((i) => i.available).map((i) => i.id));
  const itemIds = [...new Set(Array.isArray(raw.item_ids) ? raw.item_ids : [])].filter((id) => availableIds.has(id)).slice(0, 4);

  return { ok: true, result: { reply, itemIds, needsStaff: Boolean(raw.needs_staff) } };
}
