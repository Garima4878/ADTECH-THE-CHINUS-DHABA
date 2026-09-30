import express from 'express';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { config } from './config.js';
import { loadKnowledgeBase } from './knowledgeBase.js';
import { createAssistant } from './assistant.js';
import { createGeminiResponder } from './llmAssistant.js';
import { PREFERENCES, MEAL_TYPES } from './recommender.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(here, '..', 'public');
const TABLE_ID_PATTERN = /^[A-Za-z0-9_-]{1,20}$/;

function rateLimiter({ windowMs = 60_000, max = 20 } = {}) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const entry = hits.get(req.ip);
    if (!entry || now - entry.start > windowMs) {
      hits.set(req.ip, { start: now, count: 1 });
      return next();
    }
    entry.count += 1;
    if (entry.count > max) return res.status(429).json({ error: 'Too many messages. Please wait a minute and try again.' });
    next();
  };
}

function cors(allowedOrigins) {
  return (req, res, next) => {
    const origin = req.headers.origin;
    if (allowedOrigins.includes('*')) res.setHeader('Access-Control-Allow-Origin', '*');
    else if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  };
}

export function createApp({ assistant, loadKb, allowedOrigins = ['*'] }) {
  const app = express();
  app.use(express.json({ limit: '20kb' }));
  app.use('/api/ai', cors(allowedOrigins));

  app.get('/api/ai/health', async (_req, res) => {
    try {
      const kb = await loadKb();
      res.json({ status: 'ok', mode: assistant.mode, kb_version: kb._meta?.version, items: kb.items.length, live_menu: kb.liveSynced });
    } catch (err) {
      res.status(500).json({ status: 'error', error: err.message });
    }
  });

  // Public menu data (no secrets) - used by the demo page and handy for the frontend team.
  app.get('/api/ai/knowledge-base', async (_req, res) => {
    const kb = await loadKb();
    res.json({ restaurant: kb.restaurant, categories: kb.categories, items: kb.items, offers: kb.offers });
  });

  app.post('/api/ai/chat', rateLimiter(), async (req, res) => {
    const { message, history, tableId } = req.body || {};
    if (typeof message !== 'string' || !message.trim()) return res.status(400).json({ error: '"message" is required.' });
    if (message.length > 500) return res.status(400).json({ error: 'Message is too long (max 500 characters).' });
    if (tableId != null && !TABLE_ID_PATTERN.test(String(tableId))) return res.status(400).json({ error: 'Invalid "tableId".' });

    try {
      res.json(await assistant.chat({ message: message.trim(), history, tableId: tableId != null ? String(tableId) : null }));
    } catch (err) {
      console.error('[ai] chat failed:', err);
      res.status(500).json({ error: 'The assistant is unavailable right now. Please use the menu or ask the staff.' });
    }
  });

  app.post('/api/ai/recommend', async (req, res) => {
    const { preference = null, budget = null, mealType = null, vegOnly = false, limit = 3 } = req.body || {};
    if (preference !== null && !PREFERENCES.includes(preference)) {
      return res.status(400).json({ error: `"preference" must be one of: ${PREFERENCES.join(', ')}` });
    }
    if (mealType !== null && !MEAL_TYPES.includes(mealType)) {
      return res.status(400).json({ error: `"mealType" must be one of: ${MEAL_TYPES.join(', ')}` });
    }
    if (budget !== null && !(Number.isFinite(budget) && budget > 0)) return res.status(400).json({ error: '"budget" must be a positive number.' });

    try {
      res.json(await assistant.recommend({
        preference,
        maxBudget: budget,
        mealType,
        vegOnly: Boolean(vegOnly),
        limit: Math.min(Math.max(Number(limit) || 3, 1), 8),
      }));
    } catch (err) {
      console.error('[ai] recommend failed:', err);
      res.status(500).json({ error: 'Recommendations are unavailable right now.' });
    }
  });

  app.use('/widget', express.static(PUBLIC_DIR));
  app.get('/demo', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'demo.html')));
  app.get('/', (_req, res) => res.redirect('/demo'));

  return app;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const loadKb = () => loadKnowledgeBase({ menuApiUrl: config.menuApiUrl });
  const llmRespond = config.llmEnabled ? createGeminiResponder({ apiKey: config.geminiApiKey, model: config.model }) : null;
  const assistant = createAssistant({ loadKb, llmRespond });
  createApp({ assistant, loadKb, allowedOrigins: config.allowedOrigins }).listen(config.port, () => {
    console.log(`[ai] Chinu AI assistant on http://localhost:${config.port} (mode: ${assistant.mode})`);
    console.log(`[ai] Demo: http://localhost:${config.port}/demo`);
  });
}
