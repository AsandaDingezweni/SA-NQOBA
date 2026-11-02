const mongoose = require('mongoose');
const { PHASE, STATUS } = require('../engine/rules');
const { PROFILES } = require('../engine/NpcStrategy');

const { Schema } = mongoose;

const statsSchema = new Schema(
  {
    attacks: { type: Number, default: 0 },
    conquests: { type: Number, default: 0 },
    rolls: { type: Number, default: 0 },
    soldiersLost: { type: Number, default: 0 },
    soldiersKilled: { type: Number, default: 0 },
    reinforcements: { type: Number, default: 0 },
  },
  { _id: false },
);

const playerSchema = new Schema(
  {
    pid: { type: String, required: true },
    name: { type: String, required: true },
    kind: { type: String, enum: ['human', 'npc'], required: true },
    profile: { type: String, enum: [...Object.keys(PROFILES), null], default: null },
    color: { type: String, required: true },
    startCountry: { type: String, required: true },
    eliminated: { type: Boolean, default: false },
    holdStreak: { type: Number, default: 0 },
    stats: { type: statsSchema, default: () => ({}) },
  },
  { _id: false },
);

const countryStateSchema = new Schema(
  {
    code: { type: String, required: true },
    iso2: { type: String, required: true },
    name: { type: String, required: true },
    region: { type: String, required: true },
    population: { type: Number, required: true },
    value: { type: Number, required: true, min: 1, max: 9 },
    owner: { type: String, required: true },
    soldiers: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const patchSchema = new Schema({ code: String, owner: String, soldiers: Number }, { _id: false });

const eventSchema = new Schema(
  {
    seq: { type: Number, required: true },
    round: { type: Number, required: true },
    actor: { type: String, default: null },
    type: {
      type: String,
      required: true,
      enum: ['game_start', 'turn_start', 'reinforce', 'transfer', 'attack_start', 'roll', 'attack_stop', 'attack_failed', 'conquest', 'occupy', 'elimination', 'turn_end', 'victory', 'defeat'],
    },
    message: { type: String, required: true },
    reason: { type: String, default: null },
    commentary: { type: String, default: null },
    commentarySource: { type: String, enum: ['ai', 'fallback', null], default: null },
    dice: { type: new Schema({ attacker: [Number], defender: [Number] }, { _id: false }), default: null },
    patch: { type: [patchSchema], default: [] },
    data: { type: Schema.Types.Mixed, default: null },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const battleSchema = new Schema(
  {
    from: String,
    to: String,
    defender: String,
    rolls: Number,
    startAttackerSoldiers: Number,
    startDefenderSoldiers: Number,
  },
  { _id: false },
);

const gameSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    ownerName: { type: String, required: true },
    status: { type: String, enum: Object.values(STATUS), default: STATUS.ACTIVE, index: true },
    phase: { type: String, enum: Object.values(PHASE), required: true },
    round: { type: Number, default: 1 },
    turnIndex: { type: Number, default: 0 },
    turnOrder: { type: [String], required: true },
    players: { type: [playerSchema], required: true },
    countries: { type: [countryStateSchema], required: true },
    pendingReinforcements: { type: Number, default: 0 },
    attackUsed: { type: Boolean, default: false },
    battle: { type: battleSchema, default: null },
    pendingOccupy: { type: new Schema({ from: String, to: String, max: Number }, { _id: false }), default: null },
    eventSeq: { type: Number, default: 0 },
    events: { type: [eventSchema], default: [] },
    winner: { type: String, default: null },
    settings: {
      npcProfile: { type: String, enum: ['mixed', ...Object.keys(PROFILES)], default: 'mixed' },
      aiStrategist: { type: Boolean, default: false },
    },
  },
  // Two tabs sending commands at once must not interleave: stale saves fail with a VersionError.
  { timestamps: true, optimisticConcurrency: true },
);

gameSchema.index({ status: 1, updatedAt: -1 });
gameSchema.index({ owner: 1, updatedAt: -1 });

gameSchema.virtual('currentPid').get(function currentPid() {
  return this.turnOrder[this.turnIndex];
});

gameSchema.methods.toView = function toView({ since = 0 } = {}) {
  const human = this.players.find((p) => p.kind === 'human');
  return {
    id: this._id.toString(),
    owner: this.owner.toString(),
    ownerName: this.ownerName,
    status: this.status,
    phase: this.phase,
    round: this.round,
    currentPid: this.currentPid,
    turnOrder: this.turnOrder,
    players: this.players.map((p) => p.toObject()),
    countries: this.countries.map((c) => c.toObject()),
    pendingReinforcements: this.pendingReinforcements,
    attackUsed: this.attackUsed,
    battle: this.battle ? this.battle.toObject() : null,
    pendingOccupy: this.pendingOccupy ? this.pendingOccupy.toObject() : null,
    eventSeq: this.eventSeq,
    winner: this.winner,
    settings: this.settings,
    humanCountry: human?.startCountry,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    events: this.events.filter((e) => e.seq > since).map((e) => e.toObject()),
  };
};

gameSchema.methods.toSummary = function toSummary() {
  const human = this.players.find((p) => p.kind === 'human');
  const start = this.countries.find((c) => c.code === human.startCountry);
  return {
    id: this._id.toString(),
    ownerName: this.ownerName,
    status: this.status,
    round: this.round,
    startCountry: { code: start.code, name: start.name, iso2: start.iso2 },
    countriesHeld: this.countries.filter((c) => c.owner === 'human').length,
    playersAlive: this.players.filter((p) => !p.eliminated).length,
    currentPlayer: this.players.find((p) => p.pid === this.currentPid)?.name,
    updatedAt: this.updatedAt,
    createdAt: this.createdAt,
  };
};

// "campaigns" rather than "games": prototype documents in "games" have an incompatible shape and are left untouched.
module.exports = mongoose.model('Game', gameSchema, 'campaigns');
