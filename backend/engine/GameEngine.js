const Battle = require('./Battle');
const Dice = require('./Dice');
const { GameRuleError } = require('./errors');
const {
  PHASE,
  STATUS,
  HUMAN_PID,
  MIN_ATTACK_SOLDIERS,
  soldierValueFor,
  conquestReward,
  reinforcementsFor,
} = require('./rules');

const PLAYER_COLORS = ['#424D11', '#C0392B', '#2471A3', '#8E44AD', '#D35400', '#138D75', '#B7950B', '#5D6D7E', '#C2185B', '#1A237E'];

const PHASE_BLOCKERS = {
  [PHASE.REINFORCE]: 'Deploy your reinforcements first.',
  [PHASE.ATTACKING]: 'An attack is in progress: roll again or stop the attack.',
  [PHASE.OCCUPY]: 'Choose how many soldiers move into the conquered country first.',
  [PHASE.MAIN]: 'That action is not available right now.',
  [PHASE.FINISHED]: 'This game is over.',
};

function newStats() {
  return { attacks: 0, conquests: 0, rolls: 0, soldiersLost: 0, soldiersKilled: 0, reinforcements: 0 };
}

function assertWholeNumber(value, label, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new GameRuleError(`${label} must be a whole number between ${min} and ${max}.`, 'INVALID_AMOUNT');
  }
}

// Authoritative rules of the case study. Works on any object with the Game shape
// (a Mongoose document in production, a plain object in tests) and records every
// state change as an event carrying a board patch, which drives animation and replay.
class GameEngine {
  constructor(game, { dice = new Dice() } = {}) {
    this.game = game;
    this.dice = dice;
  }

  static createInitialState({ humanCountry, rivalCountries, ownerName, profileFor, shuffle }) {
    const toCountry = (c, owner) => {
      const value = soldierValueFor(c.population);
      return { code: c.code, iso2: c.iso2, name: c.name, region: c.region, population: c.population, value, owner, soldiers: value };
    };
    const countries = [toCountry(humanCountry, HUMAN_PID), ...rivalCountries.map((c) => toCountry(c, c.code))];
    const players = [
      { pid: HUMAN_PID, name: ownerName, kind: 'human', profile: null, color: PLAYER_COLORS[0], startCountry: humanCountry.code, eliminated: false, stats: newStats() },
      ...rivalCountries.map((c, i) => ({
        pid: c.code,
        name: c.name,
        kind: 'npc',
        profile: profileFor(i),
        color: PLAYER_COLORS[(i + 1) % PLAYER_COLORS.length],
        startCountry: c.code,
        eliminated: false,
        holdStreak: 0,
        stats: newStats(),
      })),
    ];
    return {
      status: STATUS.ACTIVE,
      phase: PHASE.MAIN,
      round: 1,
      turnIndex: 0,
      turnOrder: shuffle(players.map((p) => p.pid)),
      players,
      countries,
      pendingReinforcements: 0,
      attackUsed: false,
      battle: null,
      pendingOccupy: null,
      eventSeq: 0,
      events: [],
      winner: null,
    };
  }

  // ---- queries -------------------------------------------------------------

  get currentPid() {
    return this.game.turnOrder[this.game.turnIndex];
  }

  get currentPlayer() {
    return this.player(this.currentPid);
  }

  player(pid) {
    return this.game.players.find((p) => p.pid === pid);
  }

  country(code) {
    const country = this.game.countries.find((c) => c.code === code);
    if (!country) throw new GameRuleError(`Unknown country ${code}.`, 'UNKNOWN_COUNTRY');
    return country;
  }

  countriesOf(pid) {
    return this.game.countries.filter((c) => c.owner === pid);
  }

  // ---- lifecycle -----------------------------------------------------------

  start() {
    const order = this.game.turnOrder.map((pid) => this.player(pid).name).join(' → ');
    this.#emit('game_start', {
      actor: null,
      message: `SA-NQOBA campaign begins! Turn order drawn at random: ${order}.`,
      patch: this.game.countries.map((c) => c.code),
    });
    this.#beginTurn();
  }

  // ---- commands ------------------------------------------------------------

  placeReinforcements(pid, allocations, meta = {}) {
    this.#assertTurn(pid, PHASE.REINFORCE);
    const entries = Object.entries(allocations ?? {}).filter(([, n]) => n !== 0);
    const pending = this.game.pendingReinforcements;
    let total = 0;
    for (const [code, n] of entries) {
      assertWholeNumber(n, `Soldiers for ${code}`, 0, pending);
      if (this.country(code).owner !== pid) throw new GameRuleError('You can only reinforce countries you control.', 'NOT_OWNER');
      total += n;
    }
    if (total !== pending) throw new GameRuleError(`Deploy exactly ${pending} soldiers (you allocated ${total}).`, 'ALLOCATION_MISMATCH');

    for (const [code, n] of entries) this.country(code).soldiers += n;
    this.game.pendingReinforcements = 0;
    this.game.phase = PHASE.MAIN;
    const summary = entries.map(([code, n]) => `${this.country(code).name} +${n}`).join(', ');
    return this.#emit('reinforce', {
      actor: pid,
      message: `${this.player(pid).name} deployed ${pending} reinforcements: ${summary}.`,
      reason: meta.reason,
      patch: entries.map(([code]) => code),
      data: { allocations: Object.fromEntries(entries) },
    });
  }

  transfer(pid, fromCode, toCode, soldiers, meta = {}) {
    this.#assertTurn(pid, PHASE.MAIN);
    if (fromCode === toCode) throw new GameRuleError('Choose two different countries.', 'SAME_COUNTRY');
    const from = this.country(fromCode);
    const to = this.country(toCode);
    if (from.owner !== pid || to.owner !== pid) throw new GameRuleError('Transfers are only allowed between countries you control.', 'NOT_OWNER');
    assertWholeNumber(soldiers, 'Soldiers to transfer', 1, from.soldiers - 1);

    from.soldiers -= soldiers;
    to.soldiers += soldiers;
    return this.#emit('transfer', {
      actor: pid,
      message: `${this.player(pid).name} moved ${soldiers} soldier${soldiers === 1 ? '' : 's'} from ${from.name} to ${to.name}.`,
      reason: meta.reason,
      patch: [fromCode, toCode],
      data: { from: fromCode, to: toCode, soldiers },
    });
  }

  startAttack(pid, fromCode, toCode, meta = {}) {
    this.#assertTurn(pid, PHASE.MAIN);
    if (this.game.attackUsed) throw new GameRuleError('Only one attack is allowed per turn.', 'ATTACK_USED');
    const from = this.country(fromCode);
    const to = this.country(toCode);
    if (from.owner !== pid) throw new GameRuleError('Attack from a country you control.', 'NOT_OWNER');
    if (to.owner === pid) throw new GameRuleError('You cannot attack your own country.', 'OWN_TARGET');
    if (from.soldiers < MIN_ATTACK_SOLDIERS) throw new GameRuleError('You need at least 2 soldiers to attack.', 'TOO_FEW_SOLDIERS');

    const defender = this.player(to.owner);
    this.game.attackUsed = true;
    this.game.battle = {
      from: fromCode,
      to: toCode,
      defender: defender.pid,
      rolls: 0,
      startAttackerSoldiers: from.soldiers,
      startDefenderSoldiers: to.soldiers,
    };
    this.game.phase = PHASE.ATTACKING;
    this.player(pid).stats.attacks += 1;
    return this.#emit('attack_start', {
      actor: pid,
      message: `⚔️ ${this.player(pid).name} launches an attack on ${to.name} (${defender.name}) from ${from.name}: ${from.soldiers} vs ${to.soldiers}.`,
      reason: meta.reason,
      data: { from: fromCode, to: toCode, defender: defender.pid },
    });
  }

  roll(pid, meta = {}) {
    this.#assertTurn(pid, PHASE.ATTACKING);
    const { from: fromCode, to: toCode, defender } = this.game.battle;
    const from = this.country(fromCode);
    const to = this.country(toCode);
    const result = Battle.resolveRound(from.soldiers, to.soldiers, this.dice);

    from.soldiers -= result.attackerLosses;
    to.soldiers -= result.defenderLosses;
    this.game.battle.rolls += 1;

    const attacker = this.player(pid);
    const defenderPlayer = this.player(defender);
    attacker.stats.rolls += 1;
    attacker.stats.soldiersLost += result.attackerLosses;
    attacker.stats.soldiersKilled += result.defenderLosses;
    defenderPlayer.stats.soldiersLost += result.defenderLosses;
    defenderPlayer.stats.soldiersKilled += result.attackerLosses;

    const ties = result.pairs.filter((p) => p.winner === 'tie').length;
    const event = this.#emit('roll', {
      actor: pid,
      message:
        `🎲 ${from.name} [${result.attackerDice.join(', ')}] vs ${to.name} [${result.defenderDice.join(', ')}]: ` +
        `${from.name} −${result.attackerLosses}, ${to.name} −${result.defenderLosses}${ties ? `, ${ties} tie${ties > 1 ? 's' : ''}` : ''}. ` +
        `Now ${from.soldiers} vs ${to.soldiers}.`,
      reason: meta.reason,
      dice: { attacker: result.attackerDice, defender: result.defenderDice },
      patch: [fromCode, toCode],
      data: {
        from: fromCode,
        to: toCode,
        defender,
        pairs: result.pairs,
        attackerLosses: result.attackerLosses,
        defenderLosses: result.defenderLosses,
        attackerSoldiers: from.soldiers,
        defenderSoldiers: to.soldiers,
        roll: this.game.battle.rolls,
      },
    });

    if (to.soldiers === 0) {
      this.#conquer(pid, from, to);
    } else if (from.soldiers < MIN_ATTACK_SOLDIERS) {
      this.#emit('attack_failed', {
        actor: pid,
        message: `💥 ${attacker.name}'s assault on ${to.name} collapsed: ${from.name} is down to 1 soldier. ${to.name} holds with ${to.soldiers}.`,
        data: { from: fromCode, to: toCode },
      });
      this.game.battle = null;
      this.game.phase = PHASE.MAIN;
    }
    return event;
  }

  stopAttack(pid, meta = {}) {
    this.#assertTurn(pid, PHASE.ATTACKING);
    const from = this.country(this.game.battle.from);
    const to = this.country(this.game.battle.to);
    this.#emit('attack_stop', {
      actor: pid,
      message: `🏳️ ${this.player(pid).name} called off the attack on ${to.name}. ${from.name} keeps ${from.soldiers} soldier${from.soldiers === 1 ? '' : 's'}.`,
      reason: meta.reason,
      data: { from: from.code, to: to.code },
    });
    this.game.battle = null;
    this.game.phase = PHASE.MAIN;
    this.#finishTurn(pid, 'Stopping an attack ends the turn.');
  }

  occupy(pid, soldiers, meta = {}) {
    this.#assertTurn(pid, PHASE.OCCUPY);
    const { from: fromCode, to: toCode, max } = this.game.pendingOccupy;
    assertWholeNumber(soldiers, 'Soldiers to move', 0, max);
    const from = this.country(fromCode);
    const to = this.country(toCode);
    from.soldiers -= soldiers;
    to.soldiers += soldiers;
    this.game.pendingOccupy = null;
    this.game.phase = PHASE.MAIN;
    return this.#emit('occupy', {
      actor: pid,
      message: soldiers
        ? `${this.player(pid).name} moved ${soldiers} soldier${soldiers === 1 ? '' : 's'} into ${to.name} (${to.soldiers} now hold it, ${from.soldiers} remain in ${from.name}).`
        : `${this.player(pid).name} left ${to.name} with its ${to.soldiers} conquest soldiers.`,
      reason: meta.reason,
      patch: [fromCode, toCode],
      data: { from: fromCode, to: toCode, soldiers },
    });
  }

  endTurn(pid, meta = {}) {
    this.#assertTurn(pid, PHASE.MAIN);
    this.#finishTurn(pid, meta.reason);
  }

  forfeit(pid) {
    this.#assertActive();
    if (pid !== HUMAN_PID) throw new GameRuleError('Only the commander can withdraw.', 'NOT_ALLOWED');
    this.game.status = STATUS.LOST;
    this.game.phase = PHASE.FINISHED;
    this.game.battle = null;
    this.game.pendingOccupy = null;
    this.#emit('defeat', { actor: HUMAN_PID, message: `🏳️ ${this.player(HUMAN_PID).name} withdrew from the campaign.` });
  }

  // ---- internals -----------------------------------------------------------

  #assertActive() {
    if (this.game.status !== STATUS.ACTIVE) throw new GameRuleError('This game is over.', 'GAME_OVER');
  }

  #assertTurn(pid, phase) {
    this.#assertActive();
    if (this.currentPid !== pid) throw new GameRuleError(`It is ${this.currentPlayer.name}'s turn.`, 'NOT_YOUR_TURN');
    if (this.game.phase !== phase) throw new GameRuleError(PHASE_BLOCKERS[this.game.phase], 'WRONG_PHASE');
  }

  #conquer(pid, from, to) {
    const formerOwner = this.player(to.owner);
    const reward = conquestReward(to.value);
    to.owner = pid;
    to.soldiers = reward;
    this.player(pid).stats.conquests += 1;
    this.#emit('conquest', {
      actor: pid,
      message: `🏆 ${this.player(pid).name} conquered ${to.name} from ${formerOwner.name}! Gains max(2, ${to.value} ÷ 2) = ${reward} soldiers.`,
      patch: [to.code],
      data: { from: from.code, to: to.code, formerOwner: formerOwner.pid, reward },
    });
    this.game.battle = null;

    if (this.countriesOf(formerOwner.pid).length === 0) {
      formerOwner.eliminated = true;
      this.#emit('elimination', {
        actor: pid,
        message: `☠️ ${formerOwner.name} has lost every country and is eliminated.`,
        data: { eliminated: formerOwner.pid },
      });
    }
    if (this.#checkGameOver()) return;

    const max = from.soldiers - 1;
    if (max > 0) {
      this.game.pendingOccupy = { from: from.code, to: to.code, max };
      this.game.phase = PHASE.OCCUPY;
    } else {
      this.game.phase = PHASE.MAIN;
    }
  }

  #checkGameOver() {
    const owners = new Set(this.game.countries.map((c) => c.owner));
    const human = this.player(HUMAN_PID);
    if (owners.size === 1) {
      const [winner] = owners;
      this.#finish(winner, winner === HUMAN_PID
        ? `🎉 VICTORY! ${human.name} has conquered all ${this.game.countries.length} nations. Halala!`
        : `💀 ${this.player(winner).name} has conquered the world. Game over.`);
      return true;
    }
    if (human.eliminated) {
      const leader = [...owners].sort((a, b) => this.countriesOf(b).length - this.countriesOf(a).length)[0];
      this.#finish(leader, `💀 ${human.name} has been wiped off the map. Game over.`);
      return true;
    }
    return false;
  }

  #finish(winnerPid, message) {
    this.game.winner = winnerPid;
    this.game.status = winnerPid === HUMAN_PID ? STATUS.WON : STATUS.LOST;
    this.game.phase = PHASE.FINISHED;
    this.game.pendingOccupy = null;
    this.#emit(winnerPid === HUMAN_PID ? 'victory' : 'defeat', { actor: winnerPid, message });
  }

  #finishTurn(pid, reason) {
    const player = this.player(pid);
    this.#emit('turn_end', {
      actor: pid,
      message: this.game.attackUsed ? `${player.name} ends the turn.` : `${player.name} skips attacking this turn.`,
      reason,
    });
    this.#advance();
  }

  #advance() {
    const { turnOrder } = this.game;
    let index = this.game.turnIndex;
    do {
      index += 1;
      if (index >= turnOrder.length) {
        index = 0;
        this.game.round += 1;
      }
    } while (this.player(turnOrder[index]).eliminated);
    this.game.turnIndex = index;
    this.#beginTurn();
  }

  #beginTurn() {
    const player = this.currentPlayer;
    this.game.attackUsed = false;
    this.game.battle = null;
    this.game.pendingOccupy = null;

    // Reinforcements start from round 2: "The first round is complete once every player has taken one turn."
    let reinforcements = 0;
    if (this.game.round >= 2) {
      reinforcements = reinforcementsFor(this.countriesOf(player.pid).length);
      player.stats.reinforcements += reinforcements;
    }
    this.game.pendingReinforcements = reinforcements;
    this.game.phase = reinforcements > 0 ? PHASE.REINFORCE : PHASE.MAIN;
    this.#emit('turn_start', {
      actor: player.pid,
      message: `Round ${this.game.round}: ${player.name}'s turn${reinforcements ? `, with ${reinforcements} reinforcements to deploy` : ''}.`,
      data: { round: this.game.round, reinforcements },
    });
  }

  #emit(type, { actor, message, reason, dice, patch = [], data }) {
    this.game.eventSeq += 1;
    const event = {
      seq: this.game.eventSeq,
      round: this.game.round,
      actor,
      type,
      message,
      reason: reason ?? null,
      commentary: null,
      commentarySource: null,
      dice: dice ?? null,
      patch: patch.map((code) => {
        const c = this.country(code);
        return { code, owner: c.owner, soldiers: c.soldiers };
      }),
      data: data ?? null,
      at: new Date(),
    };
    this.game.events.push(event);
    return this.game.events[this.game.events.length - 1];
  }
}

module.exports = GameEngine;
