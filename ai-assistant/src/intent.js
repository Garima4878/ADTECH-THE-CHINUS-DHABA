import { normalize } from './text.js';
import { findOffMenuDish } from './guardrails.js';

const INGREDIENTS = ['chicken', 'mutton', 'egg', 'fish'];
const CATEGORIES = ['biryani', 'thali', 'roti'];

const INTENT_PATTERNS = [
  ['wait_time', /\b(how long|kitna time|kitni der|time lagega|time lagta|waiting time|wait time|how much time)\b|कितना समय|कितनी देर|टाइम/],
  ['order_help', /\b(order status|place order|how to order|payment|pay|bill|upi|refund|cart|my order)\b|ऑर्डर|बिल|पेमेंट/],
  ['contact', /\b(address|location|where|kaha|kahan|phone|contact|call|timing|timings|open|close|closing|opening|hours|khula|band)\b|पता|कहाँ|कहां|फोन/],
  ['price', /\b(price|prices|rate|rates|cost|kitna|kitne|kitni|how much|daam|dam|charge|charges)\b|कितने|कितना|दाम|कीमत|रेट/],
  ['availability', /\b(available|availability|hai kya|milega|milegi|milta|do you have|have you got|in stock|khatam|sold out)\b|मिलेगा|मिलेगी|है क्या/],
  ['recommend', /\b(suggest|suggestion|recommend|recommendation|best|popular|famous|what should|kya khau|kya khaye|kya khayen|kya lu|kya le|kya lena|tasty|accha|achha|favourite|favorite)\b|सुझाव|क्या खा|क्या लू|बढ़िया|अच्छा/],
  ['menu', /\b(menu|what do you have|kya kya|kya hai|items|dishes|list|options|serve)\b/],
];

const GREETING = /^(hi+|hello|hey|namaste|namaskar|hlo|helo|good (morning|afternoon|evening))\b|^नमस्ते|^नमस्कार/;

/** Finds knowledge-base dishes named in the text ("mutton paya korma", "अण्डा बिरयानी", "anda biryani"). */
export function findDishes(text, items) {
  const tokens = new Set(normalize(text).split(' '));
  const matches = [];
  for (const item of items) {
    const nameWords = normalize(item.name).split(' ').filter((w) => w !== 'and');
    const withoutSpecial = nameWords.filter((w) => w !== 'special');
    const full = nameWords.every((w) => tokens.has(w));
    // "chicken mutton korma" should still find "Special Chicken & Mutton Korma"
    const loose = nameWords[0] === 'special' && withoutSpecial.length >= 2 && withoutSpecial.every((w) => tokens.has(w));
    if (full || loose) matches.push({ item, words: new Set(nameWords) });
  }
  // Drop matches whose words are a subset of a longer match ("mutton korma" inside "mutton paya korma")
  return matches
    .filter((m) => !matches.some((o) => o !== m && o.words.size > m.words.size && [...m.words].every((w) => o.words.has(w))))
    .map((m) => m.item);
}

export function parseBudget(normalizedText) {
  const patterns = [
    /\brs (\d{2,5})\b/,
    /\b(\d{2,5}) rs\b/,
    /\b(?:under|below|within|upto|up to|less than|max|maximum|budget|budget of)\s+(?:rs )?(\d{2,5})\b/,
    /\b(\d{2,5})\s+(?:ke andar|ke under|tak|se kam|ke niche|or less|max|budget)\b/,
    /(\d{2,5})\s*(?:के अंदर|तक|से कम)/,
  ];
  for (const re of patterns) {
    const m = normalizedText.match(re);
    if (m) return Number(m[1]);
  }
  return null;
}

function parseMealType(text) {
  if (/\b(lunch|dopahar)\b|दोपहर/.test(text)) return 'lunch';
  if (/\b(dinner|raat|night)\b|रात/.test(text)) return 'dinner';
  if (/\b(snack|snacks|starter|starters|nashta)\b|नाश्ता/.test(text)) return 'snack';
  return null;
}

export function parseMessage(message, items) {
  const text = normalize(message);
  const padded = ` ${text} `;
  const dishes = findDishes(message, items);
  const ingredient = INGREDIENTS.find((w) => padded.includes(` ${w} `)) || null;
  const category = CATEGORIES.find((w) => padded.includes(` ${w} `)) || null;
  const nonVeg = padded.includes(' nonveg ');
  const vegOnly = !nonVeg && padded.includes(' veg ');
  const maxBudget = parseBudget(text);
  const mealType = parseMealType(text);

  let intent = INTENT_PATTERNS.find(([, re]) => re.test(text))?.[0] || null;
  if (!intent && (maxBudget || mealType)) intent = 'recommend';
  if (!intent && dishes.length) intent = 'dish_info';
  if (!intent && (ingredient || category || vegOnly || nonVeg)) intent = 'menu';
  if (!intent && GREETING.test(text)) intent = 'greeting';

  return {
    intent: intent || 'unknown',
    dishes,
    ingredient,
    category,
    vegOnly,
    nonVeg,
    maxBudget,
    mealType,
    offMenuDish: dishes.length ? null : findOffMenuDish(message, items),
    isHindi: /[ऀ-ॿ]/.test(message),
  };
}
