import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT) || 4001,
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
  menuApiUrl: process.env.MENU_API_URL || '',
  allowedOrigins: (process.env.ALLOWED_ORIGINS || '*').split(',').map((s) => s.trim()).filter(Boolean),
};

// The model is only called when a key is configured; otherwise the offline (rule-based) assistant answers.
config.llmEnabled = Boolean(config.geminiApiKey);
