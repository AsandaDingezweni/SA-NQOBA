const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name} (see backend/.env.example)`);
  return value;
}

const openAiKey = process.env.OPENAI_API_KEY ?? '';

module.exports = Object.freeze({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT) || 5000,
  mongoUri: required('MONGO_URI'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:8081,http://localhost:19006').split(',').map((s) => s.trim()).filter(Boolean),
  openAi: {
    // The placeholder from the template counts as "no key": the game falls back to rule-based commentary.
    apiKey: openAiKey.startsWith('sk-') ? openAiKey : null,
    model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
    timeoutMs: Number(process.env.OPENAI_TIMEOUT_MS) || 8000,
  },
});
