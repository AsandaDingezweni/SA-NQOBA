const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name} (see backend/.env.example)`);
  return value;
}

const groqKey = process.env.GROQ_API_KEY ?? '';

module.exports = Object.freeze({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT) || 5000,
  mongoUri: required('MONGO_URI'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:8081,http://localhost:19006').split(',').map((s) => s.trim()).filter(Boolean),
  // Groq serves an OpenAI-compatible API, so the openai SDK talks to it through baseURL.
  ai: {
    provider: 'Groq',
    // A missing or placeholder key counts as "no key": the game falls back to rule-based commentary.
    apiKey: groqKey.startsWith('gsk_') ? groqKey : null,
    baseURL: process.env.GROQ_BASE_URL ?? 'https://api.groq.com/openai/v1',
    model: process.env.GROQ_MODEL ?? 'qwen/qwen3.8-27b',
    timeoutMs: Number(process.env.AI_TIMEOUT_MS) || 8000,
  },
});
