import { GoogleGenAI, ApiError } from '@google/genai';
import { buildSystemPrompt, RESPONSE_SCHEMA } from './prompts.js';

export class ModelReplyError extends Error {}

/**
 * Creates the function that asks Gemini for an answer. Runs server-side only;
 * the API key comes from GEMINI_API_KEY and is never sent to the browser.
 */
export function createGeminiResponder({ apiKey, model, client = new GoogleGenAI({ apiKey, httpOptions: { timeout: 15_000 } }) }) {
  return async function respond({ kb, message, history, tableId }) {
    const userText = tableId ? `[Customer at table ${tableId}] ${message}` : message;
    const contents = [...history, { role: 'user', content: userText }].map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const response = await client.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction: buildSystemPrompt(kb),
        responseMimeType: 'application/json',
        responseJsonSchema: RESPONSE_SCHEMA,
        temperature: 0.3, // factual menu answers, little creativity needed
        maxOutputTokens: 1024,
      },
    });

    const finishReason = response.candidates?.[0]?.finishReason;
    if (response.promptFeedback?.blockReason) throw new ModelReplyError(`prompt blocked: ${response.promptFeedback.blockReason}`);
    if (finishReason === 'MAX_TOKENS') throw new ModelReplyError('model reply was cut off');
    if (finishReason && finishReason !== 'STOP') throw new ModelReplyError(`model stopped: ${finishReason}`);

    try {
      return JSON.parse(response.text || '');
    } catch {
      throw new ModelReplyError('model reply was not valid JSON');
    }
  };
}

/** Short, log-friendly description of why a model call failed. */
export function describeModelError(err) {
  if (err instanceof ApiError) {
    if (err.status === 400) return `bad request: ${err.message}`;
    if (err.status === 401 || err.status === 403) return 'invalid or unauthorised GEMINI_API_KEY';
    if (err.status === 429) return 'Gemini free-tier limit reached (429)';
    return `Gemini API error ${err.status}: ${err.message}`;
  }
  if (err?.name === 'AbortError' || err?.name === 'TimeoutError') return 'Gemini API timed out';
  return err?.message || String(err);
}
