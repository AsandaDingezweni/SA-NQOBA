const { randomInt } = require('node:crypto');
const mongoose = require('mongoose');
const Game = require('../models/Game');
const Country = require('../models/Country');
const GameEngine = require('../engine/GameEngine');
const NpcTurnRunner = require('../engine/NpcTurnRunner');
const { PROFILES } = require('../engine/NpcStrategy');
const { AppError } = require('../engine/errors');
const { HUMAN_PID, STATUS, COUNTRIES_PER_GAME } = require('../engine/rules');

const PROFILE_KEYS = Object.keys(PROFILES);

function shuffle(items) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

class GameService {
  constructor({ ai }) {
    this.ai = ai;
    this.runner = new NpcTurnRunner({ strategist: ai });
  }

  async create(user, { countryCode, npcProfile, aiStrategist }) {
    const humanCountry = await Country.findOne({ code: countryCode }).lean();
    if (!humanCountry) throw new AppError(`Unknown country ${countryCode}.`, { status: 404, code: 'UNKNOWN_COUNTRY' });
    const rivalCountries = await Country.aggregate([{ $match: { code: { $ne: countryCode } } }, { $sample: { size: COUNTRIES_PER_GAME - 1 } }]);

    const state = GameEngine.createInitialState({
      humanCountry,
      rivalCountries,
      ownerName: user.username,
      profileFor: () => (npcProfile === 'mixed' ? PROFILE_KEYS[randomInt(0, PROFILE_KEYS.length)] : npcProfile),
      shuffle,
    });
    const game = new Game({
      ...state,
      owner: user.id,
      ownerName: user.username,
      settings: { npcProfile, aiStrategist: Boolean(aiStrategist && this.ai.enabled) },
    });
    new GameEngine(game).start();
    await game.save();
    return game;
  }

  async get(id) {
    if (!mongoose.isValidObjectId(id)) throw new AppError('Game not found.', { status: 404, code: 'NOT_FOUND' });
    const game = await Game.findById(id);
    if (!game) throw new AppError('Game not found.', { status: 404, code: 'NOT_FOUND' });
    return game;
  }

  // Runs one human command against the engine. Spectators can read a game but never act in it.
  async act(id, user, command) {
    const game = await this.get(id);
    if (!game.owner.equals(user.id)) {
      throw new AppError('Only the commander who started this game can play it. You are spectating.', { status: 403, code: 'NOT_OWNER' });
    }
    const engine = new GameEngine(game);
    const since = game.eventSeq;
    command(engine);
    return this.#commit(engine, since);
  }

  // Plays the current NPC's whole turn. Only the owner's client drives NPC turns.
  async advance(id, user) {
    const game = await this.get(id);
    if (!game.owner.equals(user.id)) throw new AppError('Only the game owner can advance NPC turns.', { status: 403, code: 'NOT_OWNER' });
    if (game.status !== STATUS.ACTIVE) throw new AppError('This game is over.', { status: 409, code: 'GAME_OVER' });
    const engine = new GameEngine(game);
    if (engine.currentPid === HUMAN_PID) throw new AppError('It is your turn.', { status: 409, code: 'NOT_NPC_TURN' });
    const since = game.eventSeq;
    await this.runner.play(engine, { useAiStrategist: game.settings.aiStrategist });
    return this.#commit(engine, since);
  }

  async #commit(engine, since) {
    const { game } = engine;
    const fresh = game.events.filter((e) => e.seq > since);
    await this.#commentate(engine, fresh);
    try {
      await game.save();
    } catch (err) {
      if (err.name === 'VersionError') {
        throw new AppError('This game was updated from another tab. Refreshing.', { status: 409, code: 'STALE_GAME' });
      }
      throw err;
    }
    return { game: game.toView({ since: Number.MAX_SAFE_INTEGER }), events: fresh.map((e) => e.toObject()) };
  }

  // One commentary request per battle so the commentator can build a narrative across rolls.
  async #commentate(engine, events) {
    const battles = [];
    let current = null;
    for (const e of events) {
      if (e.type === 'attack_start' || (e.type === 'roll' && !current)) battles.push((current = []));
      if (e.type === 'roll') current.push(e);
    }
    await Promise.all(battles.filter((b) => b.length).map((rolls) => this.ai.commentate(engine, rolls)));
  }

  async list({ ownerId, status, search, page, limit }) {
    const filter = {};
    if (ownerId) filter.owner = ownerId;
    if (status) filter.status = status;
    if (search) {
      const rx = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ ownerName: rx }, { 'countries.name': rx }];
    }
    const [items, total] = await Promise.all([
      Game.find(filter).select('-events').sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit),
      Game.countDocuments(filter),
    ]);
    return { items: items.map((g) => g.toSummary()), total, page, pages: Math.max(1, Math.ceil(total / limit)) };
  }
}

module.exports = GameService;
