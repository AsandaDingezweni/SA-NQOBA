const { diceCount } = require('./rules');
const { GameRuleError } = require('./errors');

// One exchange of an attack. Dice are paired in roll order (die 1 vs die 1, ...)
// exactly as the case study's worked example does; a tied pair kills nobody.
class Battle {
  static resolveRound(attackerSoldiers, defenderSoldiers, dice) {
    const count = diceCount(attackerSoldiers, defenderSoldiers);
    if (count < 1) throw new GameRuleError('Not enough soldiers to roll', 'NO_DICE');

    const attackerDice = dice.roll(count);
    const defenderDice = dice.roll(count);
    const pairs = attackerDice.map((a, i) => {
      const d = defenderDice[i];
      return { attacker: a, defender: d, winner: a > d ? 'attacker' : d > a ? 'defender' : 'tie' };
    });

    return {
      attackerDice,
      defenderDice,
      pairs,
      attackerLosses: pairs.filter((p) => p.winner === 'defender').length,
      defenderLosses: pairs.filter((p) => p.winner === 'attacker').length,
    };
  }
}

module.exports = Battle;
