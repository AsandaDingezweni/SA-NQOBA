const odds = require('./OddsCalculator');
const { HUMAN_PID, MIN_ATTACK_SOLDIERS, conquestReward } = require('./rules');

const PROFILES = Object.freeze({
  aggressive: { key: 'aggressive', label: 'Aggressive Conqueror', attackThreshold: 0.45, continueThreshold: 0.3, garrison: 1, reinforceToAttack: 1 },
  balanced: { key: 'balanced', label: 'Calculated Strategist', attackThreshold: 0.6, continueThreshold: 0.4, garrison: 2, reinforceToAttack: 0.6 },
  defensive: { key: 'defensive', label: 'Fortress Builder', attackThreshold: 0.75, continueThreshold: 0.55, garrison: 3, reinforceToAttack: 0.3 },
});

const PATIENCE_STEP = 0.05;
const MIN_ATTACK_THRESHOLD = 0.35;

const pct = (p) => `${Math.round(p * 100)}%`;

// Heuristic decision-maker shared by every NPC; the profile only tunes its risk appetite.
class NpcStrategy {
  constructor(engine, pid) {
    this.engine = engine;
    this.pid = pid;
    this.player = engine.player(pid);
    this.profile = PROFILES[this.player.profile] ?? PROFILES.balanced;
  }

  get mine() {
    return this.engine.countriesOf(this.pid);
  }

  get enemies() {
    return this.engine.game.countries.filter((c) => c.owner !== this.pid);
  }

  #leaderPid() {
    const rivals = this.engine.game.players.filter((p) => p.pid !== this.pid && !p.eliminated);
    const strength = (pid) => {
      const owned = this.engine.countriesOf(pid);
      return owned.length * 100 + owned.reduce((s, c) => s + c.soldiers, 0);
    };
    return rivals.sort((a, b) => strength(b.pid) - strength(a.pid))[0]?.pid;
  }

  #surplusExcluding(code) {
    return this.mine
      .filter((c) => c.code !== code)
      .reduce((sum, c) => sum + Math.max(0, c.soldiers - this.profile.garrison), 0);
  }

  // Every legal (source, target) pair scored by conquest odds, prize size and strategic value.
  rankAttacks({ extraSoldiers = 0 } = {}) {
    const leader = this.#leaderPid();
    const candidates = [];
    for (const src of this.mine) {
      const potential = src.soldiers + extraSoldiers + this.#surplusExcluding(src.code);
      if (potential < MIN_ATTACK_SOLDIERS) continue;
      for (const tgt of this.enemies) {
        const p = odds.conquestProbability(potential, tgt.soldiers);
        const reward = conquestReward(tgt.value);
        const finishesOwner = this.engine.countriesOf(tgt.owner).length === 1;
        const motives = [];
        let bonus = reward * 0.1;
        if (tgt.owner === leader) { bonus += 0.25; motives.push(`weakens the leader ${this.engine.player(leader).name}`); }
        if (tgt.owner === HUMAN_PID) { bonus += 0.1; motives.push('pressures the human commander'); }
        if (finishesOwner) { bonus += 0.2; motives.push(`would eliminate ${this.engine.player(tgt.owner).name}`); }
        candidates.push({ from: src.code, to: tgt.code, p, potential, defenders: tgt.soldiers, reward, motives, score: p * (1 + bonus) });
      }
    }
    return candidates.sort((a, b) => b.score - a.score);
  }

  describeAttack(c) {
    const from = this.engine.country(c.from);
    const to = this.engine.country(c.to);
    const why = c.motives.length ? `; it ${c.motives.join(' and ')}` : '';
    return `${to.name} is the best target: ${pct(c.p)} conquest odds (${c.potential} available vs ${c.defenders}) from ${from.name}, prize +${c.reward} soldiers${why}.`;
  }

  // Each turn spent holding lowers the bar, so a stalemate never lasts: NPCs play to win.
  get attackThreshold() {
    const streak = this.player.holdStreak ?? 0;
    return Math.max(MIN_ATTACK_THRESHOLD, this.profile.attackThreshold - streak * PATIENCE_STEP);
  }

  decideAttack() {
    const candidates = this.rankAttacks();
    const threshold = this.attackThreshold;
    const impatient = threshold < this.profile.attackThreshold ? ` (risk bar lowered to ${pct(threshold)} after ${this.player.holdStreak} quiet turns)` : '';
    const pick = candidates.find((c) => c.p >= threshold);
    if (pick) return { attack: pick, candidates, reason: `${this.profile.label}${impatient}: ${this.describeAttack(pick)}` };
    const best = candidates[0];
    const reason = best
      ? `${this.profile.label}: no target clears my ${pct(threshold)} risk bar (best was ${this.engine.country(best.to).name} at ${pct(best.p)}). Holding to build strength.`
      : `${this.profile.label}: no country has enough soldiers to attack. Holding position.`;
    return { attack: null, candidates, reason };
  }

  planReinforcements() {
    const total = this.engine.game.pendingReinforcements;
    const attackShare = Math.round(total * this.profile.reinforceToAttack);
    const allocations = {};
    const add = (code, n) => { if (n > 0) allocations[code] = (allocations[code] ?? 0) + n; };

    const staging = this.rankAttacks({ extraSoldiers: attackShare })[0];
    const stagingCode = staging?.from ?? [...this.mine].sort((a, b) => b.soldiers - a.soldiers)[0].code;
    add(stagingCode, attackShare);

    const projected = new Map(this.mine.map((c) => [c.code, c.soldiers + (allocations[c.code] ?? 0)]));
    for (let i = 0; i < total - attackShare; i++) {
      const weakest = [...projected.entries()].sort((a, b) => a[1] - b[1])[0][0];
      projected.set(weakest, projected.get(weakest) + 1);
      add(weakest, 1);
    }

    const parts = [];
    if (attackShare) {
      parts.push(staging
        ? `${attackShare} to ${this.engine.country(stagingCode).name} to strike ${this.engine.country(staging.to).name}`
        : `${attackShare} to my strongest base ${this.engine.country(stagingCode).name}`);
    }
    if (total - attackShare) parts.push(`${total - attackShare} to shore up my weakest holdings`);
    return { allocations, reason: `${this.profile.label}: ${parts.join('; ')}.` };
  }

  // Transfers that mass spare soldiers into the attack source before the strike.
  planStaging(attack) {
    const to = this.engine.country(attack.to);
    const source = this.engine.country(attack.from);
    let staged = source.soldiers;
    const transfers = [];
    const donors = this.mine
      .filter((c) => c.code !== attack.from && c.soldiers > this.profile.garrison)
      .sort((a, b) => b.soldiers - a.soldiers);
    for (const donor of donors) {
      if (odds.conquestProbability(staged, to.soldiers) >= 0.9) break;
      const n = donor.soldiers - this.profile.garrison;
      staged += n;
      transfers.push({
        from: donor.code,
        to: attack.from,
        soldiers: n,
        reason: `${this.profile.label}: massing ${n} soldiers in ${source.name} for the strike on ${to.name}; ${donor.name} keeps a garrison of ${this.profile.garrison}.`,
      });
    }
    return transfers;
  }

  shouldContinue() {
    const { from, to } = this.engine.game.battle;
    const a = this.engine.country(from).soldiers;
    const d = this.engine.country(to).soldiers;
    const p = odds.conquestProbability(a, d);
    return p >= this.profile.continueThreshold
      ? { continue: true, reason: `Odds now ${pct(p)} (${a} vs ${d}): pressing on.` }
      : { continue: false, reason: `Odds dropped to ${pct(p)} (${a} vs ${d}), below my ${pct(this.profile.continueThreshold)} limit: retreating to preserve ${a} soldiers.` };
  }

  planOccupy() {
    const { from, to, max } = this.engine.game.pendingOccupy;
    const src = this.engine.country(from);
    const dst = this.engine.country(to);
    const soldiers = Math.max(0, Math.min(max, Math.floor((src.soldiers - dst.soldiers) / 2)));
    return {
      soldiers,
      reason: soldiers
        ? `Evening out defences: ${soldiers} move into ${dst.name}, leaving ${src.soldiers - soldiers} in ${src.name}.`
        : `${dst.name}'s ${dst.soldiers} conquest soldiers are enough; keeping ${src.name} strong.`,
    };
  }
}

module.exports = { NpcStrategy, PROFILES };
