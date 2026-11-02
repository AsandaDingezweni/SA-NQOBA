const env = require('./config/env');
const { connectDatabase } = require('./config/db');
const createApp = require('./app');
const AiService = require('./services/AiService');
const GameService = require('./services/GameService');
const StatsService = require('./services/StatsService');

async function main() {
  await connectDatabase(env.mongoUri);
  const ai = new AiService(env.openAi);
  console.log(ai.enabled ? `AI enabled (${ai.model})` : 'AI disabled: set OPENAI_API_KEY for LLM commentary and NPC strategy. Using fallback commentator.');

  const app = createApp({ env, ai, gameService: new GameService({ ai }), statsService: new StatsService() });
  app.listen(env.port, () => console.log(`SA-NQOBA server listening on http://localhost:${env.port}`));
}

main().catch((err) => {
  console.error('Failed to start SA-NQOBA:', err);
  process.exit(1);
});
