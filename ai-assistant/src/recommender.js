import { normalize } from './text.js';

export const PREFERENCES = ['chicken', 'mutton', 'egg', 'fish', 'biryani', 'thali', 'roti', 'veg'];
export const MEAL_TYPES = ['lunch', 'dinner', 'snack'];

function matchesPreference(item, preference) {
  if (!preference) return true;
  if (preference === 'veg') return item.is_veg;
  if (item.category === preference || item.main_ingredient === preference) return true;
  return normalize(item.name).split(' ').includes(preference);
}

/**
 * Rule-based recommendations. Deterministic and never invents anything:
 * it only filters and ranks items that exist in the knowledge base and are available.
 *
 * @param {object[]} items knowledge-base items
 * @param {{preference?: string, maxBudget?: number, mealType?: string, vegOnly?: boolean}} prefs
 */
export function recommend(items, prefs = {}, limit = 3) {
  const { preference, maxBudget, mealType, vegOnly } = prefs;

  let pool = items.filter((i) => i.available && matchesPreference(i, preference));
  if (vegOnly) pool = pool.filter((i) => i.is_veg);

  let overBudget = 0;
  if (maxBudget) {
    pool = pool.filter((i) => {
      const over = typeof i.price === 'number' && i.price > maxBudget;
      if (over) overBudget += 1;
      return !over;
    });
  }

  const scored = pool.map((item) => {
    let score = 0;
    if (mealType && item.meal_type?.includes(mealType)) score += 1;
    if (typeof item.price === 'number') score += maxBudget ? 2 : 0.5;
    if (normalize(item.name).startsWith('special')) score += 0.5; // house specials are advertised on the banners
    return { item, score };
  });
  scored.sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name));

  const picked = scored.slice(0, limit).map((s) => s.item);
  const unpriced = picked.filter((i) => typeof i.price !== 'number').length;

  let note = null;
  if (maxBudget && unpriced) note = 'Some prices are not listed in the app yet - please confirm with the staff that they fit your budget.';
  else if (unpriced) note = 'Prices for some dishes are not listed in the app yet - the staff can confirm them.';

  return { items: picked, overBudget, note };
}
