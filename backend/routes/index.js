const express = require('express');
const rateLimit = require('express-rate-limit');
const { validate, rules } = require('../middleware/validate');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const authController = require('../controllers/authController');
const countryController = require('../controllers/countryController');
const createGameController = require('../controllers/gameController');
const { PROFILES } = require('../engine/NpcStrategy');
const { STATUS } = require('../engine/rules');

const { string, int, oneOf, bool, countryCode, allocations, optional } = rules;

const credentials = {
  body: {
    username: string({ min: 3, max: 20, pattern: /^[A-Za-z0-9_]+$/, message: 'may only use letters, numbers and _' }),
    password: string({ min: 8, max: 72, pattern: /^(?=.*[A-Za-z])(?=.*\d)/, message: 'needs at least one letter and one number' }),
  },
};
const listQuery = {
  query: {
    status: optional(oneOf(Object.values(STATUS))),
    search: optional(string({ max: 40 })),
    page: optional(int({ min: 1, max: 1000 }), 1),
    limit: optional(int({ min: 1, max: 50 }), 12),
  },
};

const authLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please wait a few minutes.' } } });
const commandLimiter = rateLimit({ windowMs: 60_000, limit: 240, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: { code: 'RATE_LIMITED', message: 'Slow down, commander!' } } });

function createApiRouter({ gameService, statsService, ai }) {
  const router = express.Router();
  const games = createGameController(gameService);

  router.get('/health', (_req, res) => res.json({ ok: true, ai: { enabled: ai.enabled, provider: ai.provider, model: ai.model } }));

  router.post('/auth/register', authLimiter, validate(credentials), authController.register);
  router.post('/auth/login', authLimiter, validate(credentials), authController.login);
  router.get('/auth/me', requireAuth, authController.me);

  router.get(
    '/countries',
    validate({
      query: {
        search: optional(string({ max: 40 })),
        region: optional(oneOf(['Africa', 'Asia', 'Europe', 'Americas', 'Oceania'])),
        minSoldiers: optional(int({ min: 1, max: 9 }), 1),
        maxSoldiers: optional(int({ min: 1, max: 9 }), 9),
        sort: optional(oneOf(['name', 'population', 'soldiers']), 'name'),
      },
    }),
    countryController.list,
  );

  router.get('/games', validate(listQuery), games.listPublic);
  router.get('/games/mine', requireAuth, validate(listQuery), games.listMine);
  router.post(
    '/games',
    requireAuth,
    validate({ body: { countryCode: countryCode(), npcProfile: optional(oneOf(['mixed', ...Object.keys(PROFILES)]), 'mixed'), aiStrategist: optional(bool(), true) } }),
    games.create,
  );
  router.get('/games/:id', optionalAuth, validate({ query: { since: optional(int({ min: 0 }), 0) } }), games.show);

  router.use('/games/:id', requireAuth, commandLimiter);
  router.post('/games/:id/reinforce', validate({ body: { allocations: allocations() } }), games.reinforce);
  router.post('/games/:id/transfer', validate({ body: { from: countryCode(), to: countryCode(), soldiers: int({ min: 1, max: 1000 }) } }), games.transfer);
  router.post('/games/:id/attack', validate({ body: { from: countryCode(), to: countryCode() } }), games.attack);
  router.post('/games/:id/roll', games.roll);
  router.post('/games/:id/stop', games.stop);
  router.post('/games/:id/occupy', validate({ body: { soldiers: int({ min: 0, max: 1000 }) } }), games.occupy);
  router.post('/games/:id/end-turn', games.endTurn);
  router.post('/games/:id/forfeit', games.forfeit);
  router.post('/games/:id/advance', games.advance);

  router.get('/stats/me', requireAuth, async (req, res) => res.json(await statsService.forUser(req.user.id)));
  router.get('/stats/platform', async (_req, res) => res.json(await statsService.platform()));

  return router;
}

module.exports = createApiRouter;
