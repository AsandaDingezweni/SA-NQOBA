const { randomInt } = require('node:crypto');

class Dice {
  #rollOne;

  // Server-side CSPRNG so the client can never predict or influence rolls.
  constructor(rollOne = () => randomInt(1, 7)) {
    this.#rollOne = rollOne;
  }

  roll(count) {
    return Array.from({ length: count }, () => this.#rollOne());
  }

  static fromSequence(values) {
    let i = 0;
    return new Dice(() => {
      if (i >= values.length) throw new Error('Dice sequence exhausted');
      return values[i++];
    });
  }
}

module.exports = Dice;
