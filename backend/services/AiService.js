const OpenAI = require('openai');
const FallbackCommentator = require('./FallbackCommentator');

const COMMENTATOR_PROMPT = [
  'You are a high-energy South African sports commentator calling SA-NQOBA, a Risk-style world conquest game, live on radio.',
  'Use South African flavour sparingly (eish, yoh, ayoba, lekker, sharp sharp, shame) and rugby or soccer imagery.',
  'Use only the facts given; never invent numbers, countries or outcomes. No hashtags. At most one emoji.',
].join(' ');

const STRATEGIST_CANDIDATES = 5;

const outcomeOf = (data) => (data.defenderSoldiers === 0 ? 'conquest' : data.attackerSoldiers <= 1 ? 'failed' : 'continuing');

// LLM features behind one seam. Every method degrades to a rule-based answer, so the game
// never stalls on a missing key, a timeout or a malformed model reply.
class AiService {
  #client;
  #fallback = new FallbackCommentator();

  constructor({ apiKey, model, timeoutMs }) {
    this.model = model;
    this.#client = apiKey ? new OpenAI({ apiKey, timeout: timeoutMs, maxRetries: 1 }) : null;
  }

  get enabled() {
    return Boolean(this.#client);
  }

  async #complete(messages, { json = false, maxTokens = 120 } = {}) {
    const response = await this.#client.chat.completions.create({
      model: this.model,
      messages,
      max_tokens: maxTokens,
      temperature: 0.9,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    });
    return response.choices[0]?.message?.content?.trim() ?? '';
  }

  #rollFacts(engine, event) {
    const { data } = event;
    return {
      attacker: engine.player(event.actor).name,
      attackingFrom: engine.country(data.from).name,
      defender: engine.country(data.to).name,
      defenderOwner: engine.player(data.defender).name,
      rollNumber: data.roll,
      attackerDice: event.dice.attacker,
      defenderDice: event.dice.defender,
      attackerLosses: data.attackerLosses,
      defenderLosses: data.defenderLosses,
      attackerSoldiers: data.attackerSoldiers,
      defenderSoldiers: data.defenderSoldiers,
      outcome: outcomeOf(data),
    };
  }

  #fallbackLine(facts) {
    return this.#fallback.roll({ ...facts, attacker: facts.attackingFrom });
  }

  // One line per roll event, written into event.commentary / event.commentarySource.
  async commentate(engine, rollEvents) {
    if (rollEvents.length === 0) return;
    const facts = rollEvents.map((e) => this.#rollFacts(engine, e));
    let lines = null;
    if (this.enabled) {
      try {
        const reply = await this.#complete(
          [
            { role: 'system', content: COMMENTATOR_PROMPT },
            {
              role: 'user',
              content: `Call this battle roll by roll. Reply as JSON {"lines": [...]} with exactly ${facts.length} strings, one per roll in order, each at most 2 short sentences.\n${JSON.stringify(facts)}`,
            },
          ],
          { json: true, maxTokens: 70 * facts.length + 40 },
        );
        const parsed = JSON.parse(reply).lines;
        if (Array.isArray(parsed) && parsed.length === facts.length && parsed.every((l) => typeof l === 'string' && l.length)) lines = parsed;
      } catch (err) {
        console.warn(`AI commentary unavailable, using fallback: ${err.message}`);
      }
    }
    rollEvents.forEach((event, i) => {
      event.commentary = (lines?.[i] ?? this.#fallbackLine(facts[i])).slice(0, 400);
      event.commentarySource = lines ? 'ai' : 'fallback';
    });
  }

  // Lets the LLM choose among the engine's legal, pre-scored candidates (or hold).
  // Returns null when unavailable so the caller keeps the heuristic decision.
  async chooseAttack(engine, strategy, heuristic) {
    if (!this.enabled) return null;
    const candidates = heuristic.candidates.slice(0, STRATEGIST_CANDIDATES);
    if (candidates.length === 0) return null;
    const board = engine.game.countries.map((c) => ({ country: c.name, owner: engine.player(c.owner).name, soldiers: c.soldiers }));
    const options = candidates.map((c, i) => ({
      option: i + 1,
      attack: `${engine.country(c.from).name} -> ${engine.country(c.to).name}`,
      conquestOdds: `${Math.round(c.p * 100)}%`,
      prizeSoldiers: c.reward,
      notes: c.motives.join('; ') || null,
    }));
    try {
      const reply = await this.#complete(
        [
          {
            role: 'system',
            content: `You are the war council of ${strategy.player.name}, an NPC in SA-NQOBA with the "${strategy.profile.label}" personality. Your goal is to eventually conquer all ${board.length} countries. Choose the best move this turn. Reply as JSON {"choice": <option number, or 0 to hold>, "reason": "<first person, max 25 words>"}.`,
          },
          { role: 'user', content: JSON.stringify({ board, options, engineSuggestion: heuristic.attack ? candidates.indexOf(heuristic.attack) + 1 : 0 }) },
        ],
        { json: true, maxTokens: 120 },
      );
      const { choice, reason } = JSON.parse(reply);
      if (!Number.isInteger(choice) || choice < 0 || choice > candidates.length || typeof reason !== 'string') return null;
      const attack = choice === 0 ? null : candidates[choice - 1];
      const odds = attack ? ` (${Math.round(attack.p * 100)}% odds)` : '';
      return { attack, candidates: heuristic.candidates, reason: `🧠 AI strategist: ${reason.slice(0, 200)}${odds}` };
    } catch (err) {
      console.warn(`AI strategist unavailable, using heuristic: ${err.message}`);
      return null;
    }
  }
}

module.exports = AiService;
