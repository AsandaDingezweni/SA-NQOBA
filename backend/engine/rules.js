const COUNTRIES_PER_GAME = 10;
const MIN_ATTACK_SOLDIERS = 2;

// Case study population table: [upper bound (inclusive), soldiers]
const SOLDIER_BANDS = [
  [5_000_000, 1],
  [10_000_000, 2],
  [25_000_000, 3],
  [50_000_000, 4],
  [75_000_000, 5],
  [100_000_000, 6],
  [125_000_000, 7],
  [150_000_000, 8],
];
const MAX_SOLDIER_VALUE = 9;

const PHASE = Object.freeze({
  REINFORCE: 'reinforce',
  MAIN: 'main',
  ATTACKING: 'attacking',
  OCCUPY: 'occupy',
  FINISHED: 'finished',
});

const STATUS = Object.freeze({
  ACTIVE: 'active',
  WON: 'won',
  LOST: 'lost',
});

const HUMAN_PID = 'human';

function soldierValueFor(population) {
  const band = SOLDIER_BANDS.find(([limit]) => population <= limit);
  return band ? band[1] : MAX_SOLDIER_VALUE;
}

function conquestReward(soldierValue) {
  return Math.max(2, Math.floor(soldierValue / 2));
}

function reinforcementsFor(countriesOwned) {
  return 2 * countriesOwned;
}

function diceCount(attackerSoldiers, defenderSoldiers) {
  return Math.max(0, Math.min(attackerSoldiers - 1, defenderSoldiers));
}

module.exports = {
  COUNTRIES_PER_GAME,
  MIN_ATTACK_SOLDIERS,
  SOLDIER_BANDS,
  MAX_SOLDIER_VALUE,
  PHASE,
  STATUS,
  HUMAN_PID,
  soldierValueFor,
  conquestReward,
  reinforcementsFor,
  diceCount,
};
