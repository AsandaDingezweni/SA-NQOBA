const { NpcStrategy } = require('./NpcStrategy');
const { PHASE, STATUS } = require('./rules');

const MAX_ROLLS_PER_ATTACK = 500;

// Plays one complete NPC turn through the same engine commands a human uses,
// so NPCs can never break a rule the human is held to.
class NpcTurnRunner {
  constructor({ strategist } = {}) {
    this.strategist = strategist;
  }

  async play(engine, { useAiStrategist = false } = {}) {
    const { game } = engine;
    const pid = engine.currentPid;
    const strategy = new NpcStrategy(engine, pid);

    if (game.phase === PHASE.REINFORCE) {
      const plan = strategy.planReinforcements();
      engine.placeReinforcements(pid, plan.allocations, { reason: plan.reason });
    }

    let decision = strategy.decideAttack();
    if (useAiStrategist && this.strategist) {
      decision = (await this.strategist.chooseAttack(engine, strategy, decision)) ?? decision;
    }
    const player = engine.player(pid);
    if (!decision.attack) {
      player.holdStreak = (player.holdStreak ?? 0) + 1;
      engine.endTurn(pid, { reason: decision.reason });
      return;
    }
    player.holdStreak = 0;

    for (const t of strategy.planStaging(decision.attack)) {
      engine.transfer(pid, t.from, t.to, t.soldiers, { reason: t.reason });
    }
    engine.startAttack(pid, decision.attack.from, decision.attack.to, { reason: decision.reason });

    let reason;
    for (let i = 0; i < MAX_ROLLS_PER_ATTACK && game.phase === PHASE.ATTACKING; i++) {
      engine.roll(pid, { reason });
      if (game.phase !== PHASE.ATTACKING) break;
      const next = strategy.shouldContinue();
      if (!next.continue) {
        engine.stopAttack(pid, { reason: next.reason });
        return;
      }
      reason = next.reason;
    }
    if (game.status !== STATUS.ACTIVE) return;

    if (game.phase === PHASE.OCCUPY) {
      const plan = strategy.planOccupy();
      engine.occupy(pid, plan.soldiers, { reason: plan.reason });
    }
    engine.endTurn(pid, { reason: 'Attack resolved; consolidating for the next round.' });
  }
}

module.exports = NpcTurnRunner;
