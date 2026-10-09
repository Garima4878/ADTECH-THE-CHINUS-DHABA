import { parseMessage } from './intent.js';
import { offlineAnswer } from './offlineAssistant.js';
import { validateLlmResult } from './guardrails.js';
import { recommend } from './recommender.js';
import { describeModelError } from './llmAssistant.js';

const MAX_HISTORY = 6;

/** Keeps the last few turns, trimmed, starting with a user turn and alternating roles. */
export function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  const clean = history
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, 500) }));

  const out = [];
  for (const m of clean) {
    if (!out.length && m.role !== 'user') continue;
    if (out.length && out.at(-1).role === m.role) out[out.length - 1] = m;
    else out.push(m);
  }
  // The new customer message is appended as the next user turn, so history must end on the assistant.
  if (out.at(-1)?.role === 'user') out.pop();
  return out;
}

export function itemSummary(item) {
  return {
    id: item.id,
    menu_item_id: item.menu_item_id || null, // backend (MongoDB) id when the live menu is connected
    name: item.name,
    name_hi: item.name_hi,
    category: item.category,
    price: typeof item.price === 'number' ? item.price : null,
    price_status: typeof item.price === 'number' ? 'confirmed' : 'ask_staff',
    is_veg: item.is_veg,
    available: item.available,
  };
}

function present(kb, result, source) {
  const byId = new Map(kb.items.map((i) => [i.id, i]));
  return {
    reply: result.reply,
    items: result.itemIds.map((id) => byId.get(id)).filter(Boolean).map(itemSummary),
    needs_staff: result.needsStaff,
    source,
  };
}

/**
 * @param {object} deps
 * @param {() => Promise<object>} deps.loadKb returns the current knowledge base
 * @param {Function|null} deps.llmRespond Gemini responder, or null for offline mode
 */
export function createAssistant({ loadKb, llmRespond = null, logger = console }) {
  return {
    mode: llmRespond ? 'ai' : 'offline',

    async chat({ message, history = [], tableId = null }) {
      const kb = await loadKb();
      if (llmRespond) {
        try {
          const raw = await llmRespond({ kb, message, history: sanitizeHistory(history), tableId });
          const checked = validateLlmResult(raw, kb, message);
          if (checked.ok) return present(kb, checked.result, 'ai');
          logger.warn(`[ai] model reply rejected (${checked.reason}); using offline answer`);
        } catch (err) {
          logger.warn(`[ai] model call failed (${describeModelError(err)}); using offline answer`);
        }
      }
      return present(kb, offlineAnswer(kb, parseMessage(message, kb.items)), 'offline');
    },

    async recommend(prefs) {
      const kb = await loadKb();
      const result = recommend(kb.items, prefs, prefs.limit || 3);
      return { items: result.items.map(itemSummary), over_budget_count: result.overBudget, note: result.note };
    },
  };
}
