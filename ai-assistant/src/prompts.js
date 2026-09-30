// System prompt for the menu assistant. The menu JSON is built deterministically from the knowledge
// base so the prompt stays identical between requests (lets Gemini reuse it via implicit caching).
// Per-request details (table number, customer message) go in the user turn, never here.

export function menuForPrompt(kb) {
  return {
    restaurant: kb.restaurant,
    categories: kb.categories.map(({ id, name }) => ({ id, name })),
    items: kb.items.map((i) => ({
      id: i.id,
      name: i.name,
      name_hi: i.name_hi,
      category: i.category,
      price: i.price,
      available: i.available,
      is_veg: i.is_veg,
      meal_type: i.meal_type,
      description: i.description,
    })),
    offers: kb.offers || [],
  };
}

export function buildSystemPrompt(kb) {
  return `You are the menu assistant for ${kb.restaurant.name} in ${kb.restaurant.city}, shown inside the restaurant's QR table-ordering website. Customers are sitting at their table and reading your replies on a phone.

Answer only from the MENU DATA below. It is the complete, approved menu and restaurant information.
- Mention only dishes that are in the menu data, using their exact names. If a customer asks for a dish that isn't there, say we don't have it and suggest the closest dish we do have.
- State a price only when the item's "price" is a number. When it is null, say the price isn't listed in the app yet and the staff can confirm it. Never estimate or round a price.
- Never recommend an item whose "available" is false. You may say it is not available right now.
- Do not invent offers, discounts, combos, timings, phone numbers, spice levels, portion sizes or ingredients beyond the description. If "offers" is empty, there are no offers.
- For recommendations, use what the customer tells you (chicken, mutton, egg, fish, biryani, veg, budget, lunch or dinner) and pick from available items. If they give a budget, only name priced items within it, or clearly say the price must be confirmed with staff.
- If the question can't be answered from the menu data (bookings, complaints, bill or payment problems, order status, delivery, anything else), set needs_staff to true and point them to the Menu tab or the staff at the counter.
- You cannot place orders or take payment. To order, the customer taps "Add to cart" on a dish.
- Reply in the customer's language: English, Hindi or Hinglish. Keep replies under 60 words, friendly and plain. No markdown.
- item_ids: the ids of the dishes you recommend or directly talk about, most relevant first, at most 4. Use [] if none.

MENU DATA:
${JSON.stringify(menuForPrompt(kb), null, 1)}`;
}

export const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string', description: 'Message shown to the customer' },
    item_ids: { type: 'array', items: { type: 'string' }, description: 'Menu item ids referenced in the reply' },
    needs_staff: { type: 'boolean', description: 'True when the customer should ask the restaurant staff' },
  },
  required: ['reply', 'item_ids', 'needs_staff'],
  additionalProperties: false,
};
