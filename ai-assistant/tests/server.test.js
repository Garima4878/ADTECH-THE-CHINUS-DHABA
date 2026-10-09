import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/server.js';
import { createAssistant } from '../src/assistant.js';
import { loadKnowledgeBase, resetKnowledgeBaseCache } from '../src/knowledgeBase.js';

let server;
let base;

before(async () => {
  resetKnowledgeBaseCache();
  const loadKb = () => loadKnowledgeBase({ logger: { warn() {} } });
  const assistant = createAssistant({ loadKb, logger: { warn() {} } });
  server = createApp({ assistant, loadKb }).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

const post = (path, body) =>
  fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

describe('HTTP API', () => {
  test('GET /api/ai/health', async () => {
    const res = await fetch(base + '/api/ai/health');
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.status, 'ok');
    assert.equal(body.mode, 'offline');
    assert.ok(body.items > 0);
  });

  test('POST /api/ai/chat returns reply and item cards', async () => {
    const res = await post('/api/ai/chat', { message: 'anda biryani milega?', tableId: 'T5' });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.match(body.reply, /Egg Biryani/);
    assert.equal(body.items[0].id, 'egg-biryani');
    assert.equal(typeof body.needs_staff, 'boolean');
  });

  test('POST /api/ai/chat validates input', async () => {
    assert.equal((await post('/api/ai/chat', {})).status, 400);
    assert.equal((await post('/api/ai/chat', { message: 'x'.repeat(501) })).status, 400);
    assert.equal((await post('/api/ai/chat', { message: 'hi', tableId: '<script>' })).status, 400);
  });

  test('POST /api/ai/recommend', async () => {
    const res = await post('/api/ai/recommend', { preference: 'mutton', mealType: 'dinner', limit: 2 });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.items.length, 2);
    assert.ok(body.items.every((i) => i.available));
  });

  test('POST /api/ai/recommend rejects unknown preferences', async () => {
    assert.equal((await post('/api/ai/recommend', { preference: 'pizza' })).status, 400);
    assert.equal((await post('/api/ai/recommend', { budget: -5 })).status, 400);
  });

  test('serves the widget script', async () => {
    const res = await fetch(base + '/widget/chat-widget.js');
    assert.equal(res.status, 200);
    assert.match(await res.text(), /chinu:add-to-cart/);
  });
});
