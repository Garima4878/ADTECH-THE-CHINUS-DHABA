import { readFile } from 'node:fs/promises';

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
      kb.items = mergeLiveMenu(kb.items, Array.isArray(body) ? body : body.items || body.data || []);
      liveSynced = true;
    } catch (err) {
      logger.warn(`[ai] live menu fetch failed, using local knowledge base: ${err.message}`);
    }
  }

  cache = { ...kb, liveSynced };
  cachedAt = now();
  return cache;
}

/** Backend values win for price and availability; new backend items are added if they carry enough fields. */
export function mergeLiveMenu(items, liveItems) {
  const byId = new Map(liveItems.filter((i) => i && i.id != null).map((i) => [String(i.id), i]));
  const merged = items.map((item) => {
    const live = byId.get(item.id);
    if (!live) return item;
    byId.delete(item.id);
    return {
      ...item,
      price: typeof live.price === 'number' ? live.price : item.price,
      available: typeof live.available === 'boolean' ? live.available : item.available,
    };
  });
  for (const live of byId.values()) {
    if (!live.name || !live.category) continue;
    merged.push({
      id: String(live.id),
      name: live.name,
      name_hi: live.name_hi || null,
      category: live.category,
      main_ingredient: live.main_ingredient || null,
      price: typeof live.price === 'number' ? live.price : null,
      is_veg: Boolean(live.is_veg),
      available: live.available !== false,
      meal_type: live.meal_type || ['lunch', 'dinner'],
      description: live.description || '',
    });
  }
  return merged;
}
