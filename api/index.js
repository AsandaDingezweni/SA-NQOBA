const env = require('../backend/config/env');
const { connectDatabase } = require('../backend/config/db');
const createApp = require('../backend/app');
const AiService = require('../backend/services/AiService');
const GameService = require('../backend/services/GameService');
const StatsService = require('../backend/services/StatsService');

const ai = new AiService(env.ai);
const app = createApp({
  env,
  ai,
  gameService: new GameService({ ai }),
  statsService: new StatsService(),
});

let database;

module.exports = async (req, res) => {
  database ??= connectDatabase(env.mongoUri).catch((err) => {
    database = undefined;
    throw err;
  });
  try {
    await database;
  } catch (err) {
    console.error('Database connection failed:', err);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'The game database is unavailable. Try again shortly.',
      },
    }));
  }
  return app(req, res);
};
