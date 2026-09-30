import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '@google/genai';
import { createGeminiResponder, describeModelError, ModelReplyError } from '../src/llmAssistant.js';
import { loadKnowledgeBase } from '../src/knowledgeBase.js';

// A stand-in for the Gemini client so tests never call the real API.
function fakeClient(response) {
  const calls = [];
  return { calls, models: { generateContent: async (req) => { calls.push(req); return response; } } };
}
const reply = (obj, finishReason = 'STOP') => ({ text: JSON.stringify(obj), candidates: [{ finishReason }] });

describe('Gemini responder', () => {
  test('sends system prompt, JSON schema, history and table number', async () => {
    const kb = await loadKnowledgeBase({ logger: { warn() {} } });
    const client = fakeClient(reply({ reply: 'Namaste!', item_ids: [], needs_staff: false }));
    const respond = createGeminiResponder({ model: 'test-model', client });
    const out = await respond({
      kb,
      message: 'suggest chicken',
      tableId: '5',
      history: [{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'Namaste!' }],
    });

    assert.deepEqual(out, { reply: 'Namaste!', item_ids: [], needs_staff: false });
    const req = client.calls[0];
    assert.equal(req.model, 'test-model');
    assert.match(req.config.systemInstruction, /MENU DATA/);
    assert.equal(req.config.responseMimeType, 'application/json');
    assert.deepEqual(req.contents.map((c) => c.role), ['user', 'model', 'user']);
    assert.equal(req.contents[2].parts[0].text, '[Customer at table 5] suggest chicken');
  });

  test('throws on cut-off, blocked or non-JSON replies', async () => {
    const kb = await loadKnowledgeBase({ logger: { warn() {} } });
    const args = { kb, message: 'hi', history: [], tableId: null };
    const cases = [
      reply({ reply: 'x' }, 'MAX_TOKENS'),
      reply({ reply: 'x' }, 'SAFETY'),
      { text: 'not json', candidates: [{ finishReason: 'STOP' }] },
      { promptFeedback: { blockReason: 'OTHER' }, candidates: [] },
    ];
    for (const response of cases) {
      const respond = createGeminiResponder({ model: 'm', client: fakeClient(response) });
      await assert.rejects(respond(args), ModelReplyError);
    }
  });

  test('explains common API errors for the logs', () => {
    assert.match(describeModelError(new ApiError({ status: 429, message: 'quota' })), /free-tier limit/);
    assert.match(describeModelError(new ApiError({ status: 403, message: 'denied' })), /GEMINI_API_KEY/);
  });
});
