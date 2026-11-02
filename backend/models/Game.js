const mongoose = require('mongoose');

const territorySchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  owner: { type: String, required: true }, // 'Player', 'Soweto Syndicate', 'Cape Cartel', 'Zulu Dynasty'
  troops: { type: Number, required: true },
  defensiveBonus: { type: Boolean, default: false },
  adjacentTerritories: [{ type: String }],
});

const logSchema = new mongoose.Schema({
  message: { type: String, required: true },
  type: { type: String, default: 'info' }, // 'info', 'dice', 'combat', 'reinforcement', 'warning', 'conquest'
  timestamp: { type: Date, default: Date.now },
});

const gameSchema = new mongoose.Schema({
  userId: { type: String, default: 'guest' },
  status: { type: String, enum: ['in_progress', 'won', 'lost'], default: 'in_progress' },
  currentTurn: { type: String, default: 'Player' },
  turnNumber: { type: Number, default: 1 },
  actionsRemaining: { type: Number, default: 0 },
  consecutiveSixes: { type: Number, default: 0 },
  lastDiceRoll: { type: Number, default: null },
  territories: [territorySchema],
  battleLog: [logSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

gameSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Game', gameSchema);
