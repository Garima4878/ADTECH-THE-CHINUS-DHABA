import { readFile } from 'node:fs/promises';
import { normalize } from './text.js';

const KB_PATH = new URL('../data/restaurant-knowledge-base.json', import.meta.url);
const CACHE_TTL_MS = 60_000;

let cache = null;
let cachedAt = 0;

export function resetKnowledgeBaseCache() {
  cache = null;
  cachedAt = 0;
}

/**
 * Loads the approved menu. When MENU_API_URL is set, live price/availability from the
 * backend overrides the local JSON so the assistant never recommends a sold-out dish.
 * If the backend is unreachable, the local knowledge base is used and a warning is logged.
 */
export async function loadKnowledgeBase({ menuApiUrl = '', fetchImpl = fetch, now = Date.now, logger = console } = {}) {
  if (cache && now() - cachedAt < CACHE_TTL_MS) return cache;

  const kb = JSON.parse(await readFile(KB_PATH, 'utf8'));
  let liveSynced = false;
  if (menuApiUrl) {
    try {
      const res = await fetchImpl(menuApiUrl, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      kb.items = mergeLiveMenu(kb.items, extractMenuList(body), kb.categories);
      liveSynced = true;
    } catch (err) {
      logger.warn(`[ai] live menu fetch failed, using local knowledge base: ${err.message}`);
    }
  }

  cache = { ...kb, liveSynced };
  cachedAt = now();
  return cache;
}

/**
 * Accepts the team backend's response ({ success, data: { menu: [...] } }, see src/controllers/menuController.js)
 * as well as a plain array or { items: [...] }.
 */
export function extractMenuList(body) {
  if (Array.isArray(body)) return body;
  const list = body?.data?.menu ?? body?.data?.items ?? body?.menu ?? body?.items ?? body?.data;
  if (!Array.isArray(list)) throw new Error('menu API response has no menu list');
  return list;
}

const nameKey = (name) => normalize(name).replace(/\s+/g, ' ');
const liveId = (live) => (live._id ?? live.id) != null ? String(live._id ?? live.id) : null;
const liveAvailable = (live) => (typeof live.isAvailable === 'boolean' ? live.isAvailable : live.available);

/**
 * Backend values win for price and availability. Items are matched by our id first, then by dish name,
 * because the backend uses MongoDB ids. The backend id is kept as `menu_item_id` so "Add to cart"
 * from the chat sends the id the cart and order API understand.
 * Backend dishes we don't know yet are added so the AI can still talk about them.
 */
export function mergeLiveMenu(items, liveItems, categories = []) {
  const live = liveItems.filter((i) => i && (i.name || liveId(i) != null));
  const used = new Set();
  const findLive = (item) =>
    live.find((l) => !used.has(l) && liveId(l) === item.id) ||
    live.find((l) => !used.has(l) && l.name && nameKey(l.name) === nameKey(item.name));

  const merged = items.map((item) => {
    const match = findLive(item);
    if (!match) return item;
    used.add(match);
    const available = liveAvailable(match);
    return {
      ...item,
      menu_item_id: liveId(match),
      price: typeof match.price === 'number' ? match.price : item.price,
      available: typeof available === 'boolean' ? available : item.available,
    };
  });

  const categoryIds = new Set(categories.map((c) => c.id));
  for (const l of live) {
    if (used.has(l) || liveId(l) == null || !l.name) continue;
    const categoryName = typeof l.category === 'object' ? l.category?.name : l.category;
    const category = categoryName && categoryIds.has(nameKey(categoryName)) ? nameKey(categoryName) : 'other';
    const available = liveAvailable(l);
    merged.push({
      id: liveId(l),
      menu_item_id: liveId(l),
      name: l.name,
      name_hi: l.name_hi || null,
      category,
      main_ingredient: null,
      price: typeof l.price === 'number' ? l.price : null,
      is_veg: Boolean(l.is_veg ?? l.isVeg),
      available: available !== false,
      meal_type: ['lunch', 'dinner'],
      description: l.description || '',
    });
  }
  return merged;
}
