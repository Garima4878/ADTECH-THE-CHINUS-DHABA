// Normalises customer text (English, Hindi, Hinglish) into lowercase English keywords
// so the same matching rules work for "anda biryani", "अण्डा बिरयानी" and "Egg Biryani".

const REPLACEMENTS = [
  [/चिकन|मुर्गा|मुर्गी|\bmurga\b|\bmurgh\b|\bmurgi\b/g, 'chicken'],
  [/मटन|गोश्त|बकरा|\bgosht\b|\bbakra\b/g, 'mutton'],
  [/अण्डा|अंडा|अंडे|अण्डे|\banda\b|\bande\b|\bandaa\b|\beggs\b/g, 'egg'],
  [/फिश|मछली|\bmachli\b|\bmachhli\b|\bmachhi\b|\bmachi\b/g, 'fish'],
  [/बिरयानी|बिरियानी|\bbiriyani\b|\bbiryaani\b|\bbirani\b/g, 'biryani'],
  [/थाली|\bthaali\b/g, 'thali'],
  [/रोटी|\brotis\b|\brotiya\b/g, 'roti'],
  [/हाण्डी|हांडी|हंडी|\bhandi\b|\bhaandi\b/g, 'handi'],
  [/कोरमा|\bqorma\b|\bkurma\b/g, 'korma'],
  [/रोस्ट/g, 'roast'],
  [/फ्राय|फ्राई|\bfried\b|\bfri\b/g, 'fry'],
  [/पाया/g, 'paya'],
  [/ज्वार|\bjowari\b|\bjwar\b/g, 'jowar'],
  [/बाजरा|\bbajri\b/g, 'bajra'],
  [/मक्का|मक्के|\bmakki\b|\bmakke\b|\bmaize\b|\bcorn\b/g, 'makka'],
  [/स्पेशल|\bspl\b|\bspecial\b/g, 'special'],
  [/नॉन\s*वेज|मांसाहारी|\bnon[\s-]?veg\b|\bnonveg\b|\bnon[\s-]?vegetarian\b/g, 'nonveg'],
  [/वेज|शाकाहारी|\bvegetarian\b|\bveggie\b/g, 'veg'],
  [/मेनू|\bmenu\b/g, 'menu'],
  [/₹|\brs\.?|\binr\b|\brupees?\b|\brupaye\b|\brupay\b|रुपये|रुपए/g, ' rs '],
];

export function normalize(text) {
  let out = String(text || '').toLowerCase();
  for (const [pattern, replacement] of REPLACEMENTS) out = out.replace(pattern, replacement);
  return out.replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}

export function words(text) {
  return new Set(normalize(text).split(' ').filter(Boolean));
}
