import { recommend } from './recommender.js';

// Rule-based assistant. Used when no API key is configured, and as the safety net
// whenever the AI model fails or its reply is rejected by the guardrails.

const priceText = (item) => (typeof item.price === 'number' ? `₹${item.price}` : 'price not listed - please ask staff');
const nameList = (items) => items.map((i) => i.name).join(', ');
const available = (items) => items.filter((i) => i.available);

function groupItems(kb, parsed) {
  const pref = parsed.category || parsed.ingredient;
  return kb.items.filter((i) => {
    if (parsed.vegOnly && !i.is_veg) return false;
    if (parsed.nonVeg && i.is_veg) return false;
    if (!pref) return true;
    return i.category === pref || i.main_ingredient === pref || i.name.toLowerCase().includes(pref);
  });
}

function fallback(kb, parsed) {
  return {
    reply: parsed.isHindi && kb.fallback.message_hi ? kb.fallback.message_hi : kb.fallback.message,
    itemIds: [],
    needsStaff: true,
  };
}

export function offlineAnswer(kb, parsed) {
  const { intent, dishes } = parsed;

  // A well-known dish that isn't on our menu: say so plainly, then offer what we do have.
  if (parsed.offMenuDish) {
    const similar = parsed.ingredient ? available(groupItems(kb, { ...parsed, category: null })) : [];
    const suggestion = similar.length ? ` Our ${parsed.ingredient} dishes: ${nameList(similar.slice(0, 4))}.` : ' Please check the Menu tab for what we serve.';
    return {
      reply: `Sorry, ${parsed.offMenuDish} is not on our menu.${suggestion}`,
      itemIds: similar.slice(0, 4).map((i) => i.id),
      needsStaff: false,
    };
  }

  switch (intent) {
    case 'greeting':
      return {
        reply: `Namaste! Welcome to ${kb.restaurant.name}. Ask me about any dish, or try "suggest chicken for dinner" or "biryani under ₹200".`,
        itemIds: [],
        needsStaff: false,
      };

    case 'wait_time':
      return {
        reply: 'Food usually takes around 15 minutes to prepare after you order. If it is taking longer, please ask the staff.',
        itemIds: [],
        needsStaff: false,
      };

    case 'order_help':
      return {
        reply: 'To order, tap "Add to cart" on any dish, then open the cart to place your order and pay. For bill, payment or order-status questions, please ask the staff at the counter.',
        itemIds: [],
        needsStaff: true,
      };

    case 'contact': {
      const r = kb.restaurant;
      const parts = [`We are ${r.name} in ${r.city}.`];
      if (r.address) parts.push(`Address: ${r.address}.`);
      if (r.phone) parts.push(`Phone: ${r.phone}.`);
      if (r.opening_hours) parts.push(`Timings: ${r.opening_hours}.`);
      const missing = !r.address || !r.phone || !r.opening_hours;
      if (missing) parts.push('For other details, please ask the staff at the counter.');
      return { reply: parts.join(' '), itemIds: [], needsStaff: missing };
    }

    case 'price': {
      if (!dishes.length && !parsed.ingredient && !parsed.category && !parsed.vegOnly) {
        return { reply: 'Which dish would you like the price for? For example, "Chicken Biryani price".', itemIds: [], needsStaff: false };
      }
      const targets = dishes.length ? dishes : groupItems(kb, parsed);
      if (!targets.length) return fallback(kb, parsed);
      const lines = targets.slice(0, 6).map((i) => `${i.name}: ${priceText(i)}${i.available ? '' : ' (not available right now)'}`);
      return {
        reply: lines.join('\n'),
        itemIds: available(targets).slice(0, 4).map((i) => i.id),
        needsStaff: targets.some((i) => typeof i.price !== 'number'),
      };
    }

    case 'availability': {
      if (dishes.length) {
        const lines = dishes.map((i) => (i.available ? `Yes, ${i.name} is available.` : `Sorry, ${i.name} is not available right now.`));
        return { reply: lines.join(' '), itemIds: available(dishes).map((i) => i.id), needsStaff: false };
      }
      if (parsed.ingredient || parsed.category || parsed.vegOnly) {
        const group = available(groupItems(kb, parsed));
        if (!group.length) return fallback(kb, parsed);
        return { reply: `Available now: ${nameList(group)}.`, itemIds: group.slice(0, 4).map((i) => i.id), needsStaff: false };
      }
      return { reply: `I couldn't find that dish on our menu. ${kb.fallback.message}`, itemIds: [], needsStaff: true };
    }

    case 'recommend': {
      const preference = parsed.category || parsed.ingredient || (parsed.vegOnly ? 'veg' : null);
      const result = recommend(kb.items, {
        preference,
        maxBudget: parsed.maxBudget,
        mealType: parsed.mealType,
        vegOnly: parsed.vegOnly,
      });
      if (!result.items.length) {
        const budgetHint = parsed.maxBudget ? ` within ₹${parsed.maxBudget}` : '';
        return {
          reply: `Sorry, I couldn't find a dish that matches that${budgetHint} right now. Please check the Menu tab or ask the staff.`,
          itemIds: [],
          needsStaff: true,
        };
      }
      const picks = result.items.map((i) => (typeof i.price === 'number' ? `${i.name} (₹${i.price})` : i.name)).join(', ');
      return {
        reply: `You could try: ${picks}.${result.note ? ` ${result.note}` : ''}`,
        itemIds: result.items.map((i) => i.id),
        needsStaff: false,
      };
    }

    case 'menu': {
      if (parsed.ingredient || parsed.category || parsed.vegOnly || parsed.nonVeg) {
        const group = available(groupItems(kb, parsed));
        if (!group.length) return fallback(kb, parsed);
        return { reply: `Here's what we have: ${nameList(group)}.`, itemIds: group.slice(0, 4).map((i) => i.id), needsStaff: false };
      }
      const summary = kb.categories
        .map((c) => ({ c, n: kb.items.filter((i) => i.category === c.id && i.available).length }))
        .filter((x) => x.n)
        .map((x) => `${x.c.name} (${x.n})`)
        .join(', ');
      return { reply: `Our menu has: ${summary}. Ask about any category, e.g. "show mutton dishes".`, itemIds: [], needsStaff: false };
    }

    case 'dish_info': {
      const i = dishes[0];
      const status = i.available ? 'Available now.' : 'Not available right now.';
      return {
        reply: `${i.name}: ${i.description} ${status} Price: ${priceText(i)}.`,
        itemIds: i.available ? [i.id] : [],
        needsStaff: typeof i.price !== 'number',
      };
    }

    default:
      return fallback(kb, parsed);
  }
}
