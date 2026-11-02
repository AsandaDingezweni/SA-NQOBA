const test = require('node:test');
const assert = require('node:assert/strict');
const Battle = require('../engine/Battle');
const Dice = require('../engine/Dice');
const GameEngine = require('../engine/GameEngine');
const NpcTurnRunner = require('../engine/NpcTurnRunner');
const odds = require('../engine/OddsCalculator');
const catalogue = require('../data/countries');
const { soldierValueFor, conquestReward, diceCount, PHASE, STATUS, HUMAN_PID } = require('../engine/rules');

const byCode = (code) => catalogue.find((c) => c.code === code);

function newGame({ human = 'ZAF', rivals = ['IND', 'BRA', 'NGA', 'DEU', 'KEN', 'NZL', 'VAT', 'ISL', 'FJI'], profile = 'balanced', dice } = {}) {
  const state = GameEngine.createInitialState({
    humanCountry: byCode(human),
    rivalCountries: rivals.map(byCode),
    ownerName: 'Tester',
    profileFor: () => profile,
    shuffle: (pids) => pids,
  });
  const engine = new GameEngine(state, dice ? { dice } : undefined);
  engine.start();
  return engine;
}

test('soldier values follow the population table', () => {
  assert.equal(soldierValueFor(5_000_000), 1);
  assert.equal(soldierValueFor(5_000_001), 2);
  assert.equal(soldierValueFor(byCode('ZAF').population), 5);
  assert.equal(soldierValueFor(byCode('IND').population), 9);
  assert.equal(soldierValueFor(byCode('VAT').population), 1);
  assert.equal(soldierValueFor(149_999_999), 8);
});

test('conquest reward is max(2, value / 2) rounded down', () => {
  assert.equal(conquestReward(9), 4);
  assert.equal(conquestReward(1), 2);
  assert.equal(conquestReward(5), 2);
  assert.equal(conquestReward(6), 3);
});

test('dice count is the smaller of attacker-1 and defender', () => {
  assert.equal(diceCount(10, 2), 2);
  assert.equal(diceCount(3, 5), 2);
  assert.equal(diceCount(2, 5), 1);
});

test('case study worked example: 1v2 and 4v3 cost each side one soldier', () => {
  const r = Battle.resolveRound(10, 2, Dice.fromSequence([1, 4, 2, 3]));
  assert.deepEqual(r.attackerDice, [1, 4]);
  assert.deepEqual(r.defenderDice, [2, 3]);
  assert.equal(r.attackerLosses, 1);
  assert.equal(r.defenderLosses, 1);
});

test('a tied pair kills nobody', () => {
  const r = Battle.resolveRound(5, 1, Dice.fromSequence([4, 4]));
  assert.equal(r.attackerLosses, 0);
  assert.equal(r.defenderLosses, 0);
});

test('exact odds match hand calculation', () => {
  assert.ok(Math.abs(odds.conquestProbability(2, 1) - 0.5) < 1e-9);
  assert.ok(Math.abs(odds.conquestProbability(3, 1) - 0.75) < 1e-9);
  assert.equal(odds.conquestProbability(1, 3), 0);
  assert.ok(odds.conquestProbability(20, 2) > 0.95);
});

test('first round has no reinforcements and turn order is respected', () => {
  const engine = newGame();
  assert.equal(engine.currentPid, HUMAN_PID);
  assert.equal(engine.game.phase, PHASE.MAIN);
  assert.equal(engine.game.pendingReinforcements, 0);
  assert.equal(engine.country('ZAF').soldiers, 5);
});

test('attack until conquest, then occupy and receive 2 per country next round', () => {
  // ZAF (5) attacks VAT (1): 1 die each, attacker rolls 6 vs 1.
  const engine = newGame({ dice: Dice.fromSequence([6, 1]) });
  engine.startAttack(HUMAN_PID, 'ZAF', 'VAT');
  assert.throws(() => engine.transfer(HUMAN_PID, 'ZAF', 'VAT', 1), /attack is in progress/);
  engine.roll(HUMAN_PID);
  assert.equal(engine.country('VAT').owner, HUMAN_PID);
  assert.equal(engine.country('VAT').soldiers, 2);
  assert.equal(engine.player('VAT').eliminated, true);
  assert.equal(engine.game.phase, PHASE.OCCUPY);
  engine.occupy(HUMAN_PID, 2);
  assert.deepEqual([engine.country('ZAF').soldiers, engine.country('VAT').soldiers], [3, 4]);
  assert.throws(() => engine.startAttack(HUMAN_PID, 'ZAF', 'ISL'), /one attack/);
  engine.transfer(HUMAN_PID, 'VAT', 'ZAF', 1);
  assert.throws(() => engine.transfer(HUMAN_PID, 'ZAF', 'VAT', 4), /between 1 and 3/);
  engine.endTurn(HUMAN_PID);

  while (engine.currentPid !== HUMAN_PID) engine.endTurn(engine.currentPid);
  assert.equal(engine.game.round, 2);
  assert.equal(engine.game.phase, PHASE.REINFORCE);
  assert.equal(engine.game.pendingReinforcements, 4);
  assert.throws(() => engine.placeReinforcements(HUMAN_PID, { ZAF: 3 }), /exactly 4/);
  assert.throws(() => engine.placeReinforcements(HUMAN_PID, { IND: 4 }), /countries you control/);
  engine.placeReinforcements(HUMAN_PID, { ZAF: 1, VAT: 3 });
  assert.equal(engine.game.phase, PHASE.MAIN);
});

test('attack ends when the attacker is down to one soldier', () => {
  const engine = newGame({ human: 'NZL', rivals: ['ZAF', 'IND', 'BRA', 'NGA', 'DEU', 'KEN', 'VAT', 'ISL', 'FJI'], dice: Dice.fromSequence([1, 6]) });
  engine.startAttack(HUMAN_PID, 'NZL', 'ZAF');
  engine.roll(HUMAN_PID);
  assert.equal(engine.country('NZL').soldiers, 1);
  assert.equal(engine.country('ZAF').owner, 'ZAF');
  assert.equal(engine.game.phase, PHASE.MAIN);
  assert.equal(engine.game.battle, null);
});

test('stopping an attack ends the turn', () => {
  const engine = newGame({ dice: Dice.fromSequence([3, 3, 3, 3, 3, 3, 3, 3]) });
  engine.startAttack(HUMAN_PID, 'ZAF', 'IND');
  engine.roll(HUMAN_PID);
  engine.stopAttack(HUMAN_PID);
  assert.notEqual(engine.currentPid, HUMAN_PID);
});

test('commands out of turn are rejected', () => {
  const engine = newGame();
  assert.throws(() => engine.endTurn('IND'), /Tester's turn/);
});

test('NPCs play full games without breaking a rule', async () => {
  const runner = new NpcTurnRunner();
  for (const profile of ['aggressive', 'balanced', 'defensive']) {
    const engine = newGame({ profile });
    let turns = 0;
    while (engine.game.status === STATUS.ACTIVE && turns < 2000) {
      if (engine.currentPid === HUMAN_PID) {
        if (engine.game.phase === PHASE.REINFORCE) {
          engine.placeReinforcements(HUMAN_PID, { [engine.countriesOf(HUMAN_PID)[0].code]: engine.game.pendingReinforcements });
        }
        engine.endTurn(HUMAN_PID);
      } else {
        await runner.play(engine);
      }
      turns++;
      for (const c of engine.game.countries) assert.ok(c.soldiers >= 1, `${c.code} has ${c.soldiers}`);
    }
    assert.equal(engine.game.status, STATUS.LOST, `${profile} NPCs should beat a passive human`);
    assert.ok(engine.game.events.some((e) => e.reason), 'NPC decisions carry reasons');
  }
});
