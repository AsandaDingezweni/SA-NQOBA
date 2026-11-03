const pick = (lines) => lines[Math.floor(Math.random() * lines.length)];

// Rule-based commentary used when no Groq key is configured or the API call fails.
class FallbackCommentator {
  roll({ attacker, defender, attackerLosses, defenderLosses, attackerSoldiers, defenderSoldiers, outcome }) {
    if (outcome === 'conquest') {
      return pick([
        `Ayoba! ${attacker} storm through and ${defender} falls, what a finish!`,
        `It's all over in ${defender}! ${attacker} plant the flag, the crowd goes wild!`,
        `Yoh yoh yoh! ${attacker} take ${defender}, that's a trophy moment, sharp sharp!`,
      ]);
    }
    if (outcome === 'failed') {
      return pick([
        `Eish! ${attacker} run out of steam, ${defender} hold the line like a Springbok scrum!`,
        `Shame man, ${attacker} are down to their last soldier. ${defender} survive!`,
      ]);
    }
    if (attackerLosses === 0 && defenderLosses === 0) {
      return pick([`Dead even! Every die tied, nobody falls, the tension is lekker.`, `Stalemate on that roll, both sides staring each other down!`]);
    }
    if (defenderLosses > attackerLosses) {
      return pick([
        `${attacker} punch through, ${defender} lose ${defenderLosses}! It's ${attackerSoldiers} against ${defenderSoldiers} now.`,
        `Lovely work from ${attacker}, ${defenderLosses} down for ${defender}. Can they keep the momentum?`,
      ]);
    }
    if (attackerLosses > defenderLosses) {
      return pick([
        `${defender} bite back! ${attacker} lose ${attackerLosses}, the score sits ${attackerSoldiers} versus ${defenderSoldiers}.`,
        `Eish, a costly roll for ${attacker}. ${defender} defending like Bafana on a good day!`,
      ]);
    }
    return `Trading blows! Both lose ${attackerLosses}. ${attackerSoldiers} versus ${defenderSoldiers}, who blinks first?`;
  }
}

module.exports = FallbackCommentator;
