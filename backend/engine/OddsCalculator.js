const { diceCount } = require('./rules');

// Pairs are independent: each pair is won by the attacker 15/36, the defender 15/36, tied 6/36.
const P_ATTACKER = 15 / 36;
const P_DEFENDER = 15 / 36;
const P_TIE = 6 / 36;
const CAP = 60;

const factorial = [1];
for (let i = 1; i <= CAP; i++) factorial[i] = factorial[i - 1] * i;

// Exact probability that an attacker who keeps rolling conquers the defender,
// computed by dynamic programming over (attacker soldiers, defender soldiers).
class OddsCalculator {
  #memo = new Map();

  conquestProbability(attackerSoldiers, defenderSoldiers) {
    const largest = Math.max(attackerSoldiers, defenderSoldiers);
    if (largest <= CAP) return this.#p(attackerSoldiers, defenderSoldiers);
    // Beyond the table, keep the force ratio rather than clamping both sides to the cap.
    const scale = CAP / largest;
    return this.#p(Math.max(1, Math.round(attackerSoldiers * scale)), Math.max(1, Math.round(defenderSoldiers * scale)));
  }

  #p(a, d) {
    if (d <= 0) return 1;
    if (a <= 1) return 0;
    const key = a * 1000 + d;
    if (this.#memo.has(key)) return this.#memo.get(key);

    const n = diceCount(a, d);
    let total = 0;
    for (let won = 0; won <= n; won++) {
      for (let lost = 0; lost <= n - won; lost++) {
        if (won === 0 && lost === 0) continue;
        const tied = n - won - lost;
        const ways = factorial[n] / (factorial[won] * factorial[lost] * factorial[tied]);
        const prob = ways * P_ATTACKER ** won * P_DEFENDER ** lost * P_TIE ** tied;
        total += prob * this.#p(a - lost, d - won);
      }
    }
    const result = total / (1 - P_TIE ** n);
    this.#memo.set(key, result);
    return result;
  }
}

module.exports = new OddsCalculator();
