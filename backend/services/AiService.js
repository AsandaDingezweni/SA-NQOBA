const OpenAI = require('openai');
const FallbackCommentator = require('./FallbackCommentator');

const COMMENTATOR_PROMPT = [
  'You are a high-energy South African sports commentator calling SA-NQOBA, a Risk-style world conquest game, live on radio.',
  'Use South African flavour sparingly (eish, yoh, ayoba, lekker, sharp sharp, shame) and rugby or soccer imagery.',
  'Use only the facts given; never invent numbers, countries or outcomes. No hashtags. At most one emoji.',
].join(' ');

const STRATEGIST_CANDIDATES = 5;
const DEFAULT_COOLDOWN_S = 10;

const outcomeOf = (data) => (data.defenderSoldiers === 0 ? 'conquest' : data.attackerSoldiers <= 1 ? 'failed' : 'continuing');
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Groq's reasoning models (gpt-oss) think before answering and need extra output budget.
const isReasoningModel = (model) => model.includes('gpt-oss');

// LLM features behind one seam. Every method degrades to a rule-based answer, so the game
// never stalls on a missing key, a timeout, a rate limit or a malformed model reply.
class AiService {
  #client;
  #fallback = new FallbackCommentator();
  #cooldownUntil = 0;

  constructor({ provider, apiKey, baseURL, model, timeoutMs }) {
    this.provider = provider;
    this.model = model;
    // No SDK retries: a 429 retry would stall an NPC turn; the fallback answers instantly instead.
    this.#client = apiKey ? new OpenAI({ apiKey, baseURL, timeout: timeoutMs, maxRetries: 0 }) : null;
  }

  get enabled() {
    return Boolean(this.#client);
  }

  async #complete(messages, { json = false, maxTokens = 120 } = {}) {
    if (Date.now() < this.#cooldownUntil) throw new Error('rate limited, cooling down');
    const reasoning = isReasoningModel(this.model);
    try {
      const response = await this.#client.chat.completions.create({
        model: this.model,
        messages,
        // Groq counts the requested max_tokens against the per-minute limit, so keep it tight.
        max_tokens: reasoning ? maxTokens + 300 : maxTokens,
        temperature: 0.7,
        ...(reasoning ? { reasoning_effort: 'low' } : {}),
        ...(json ? { response_format: { type: 'json_object' } } : {}),
      });
      return response.choices[0]?.message?.content?.trim() ?? '';
    } catch (err) {
      if (err.status === 429) {
        const header = Number(err.headers?.get?.('retry-after'));
        const fromMessage = Number(/try again in ([\d.]+)s/.exec(err.message)?.[1]);
        const seconds = header || fromMessage || DEFAULT_COOLDOWN_S;
        this.#cooldownUntil = Date.now() + seconds * 1000;
        console.warn(`${this.provider} rate limit reached; using fallback for ${seconds.toFixed(1)}s.`);
      }
      throw err;
    }
  }

  // Plain sentences rather than raw JSON: models paraphrase sentences without inventing numbers.
  #rollFacts(engine, event) {
    const { data } = event;
    const attacker = engine.player(event.actor).name;
    const from = engine.country(data.from).name;
    const to = engine.country(data.to).name;
    const holder = engine.player(data.defender).name;
    const outcome = outcomeOf(data);
    const result =
      outcome === 'conquest'
        ? `${to} has no soldiers left: ${attacker} conquers ${to}.`
        : outcome === 'failed'
          ? `${attacker} is down to 1 soldier in ${from}: the attack fails and ${to} holds.`
          : `Now ${plural(data.attackerSoldiers, 'attacker')} vs ${plural(data.defenderSoldiers, 'defender')}. The attack continues.`;
    return {
      sentence:
        `Roll ${data.roll}: ${attacker} attacks ${to}${holder === to ? '' : ` (held by ${holder})`} from ${from}. ` +
        `Dice: attacker ${event.dice.attacker.join(',')} vs defender ${event.dice.defender.join(',')}. ` +
        `${attacker} loses ${data.attackerLosses}, ${holder} loses ${data.defenderLosses}. ${result}`,
      fallback: { ...data, attacker: from, defender: to, outcome },
    };
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
              content: `Call this battle roll by roll. Reply as JSON {"lines": [...]} with exactly ${facts.length} strings, one per roll in order, each at most 25 words.\n${facts.map((f) => f.sentence).join('\n')}`,
            },
          ],
          { json: true, maxTokens: 50 * facts.length + 60 },
        );
        const parsed = JSON.parse(reply).lines;
        if (Array.isArray(parsed) && parsed.length === facts.length && parsed.every((l) => typeof l === 'string' && l.length)) lines = parsed;
      } catch (err) {
        if (err.status !== 429 && !/cooling down/.test(err.message)) console.warn(`AI commentary unavailable, using fallback: ${err.message}`);
      }
    }
    rollEvents.forEach((event, i) => {
      event.commentary = (lines?.[i] ?? this.#fallback.roll(facts[i].fallback)).slice(0, 400);
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
        { json: true, maxTokens: 90 },
      );
      const { choice, reason } = JSON.parse(reply);
      if (!Number.isInteger(choice) || choice < 0 || choice > candidates.length || typeof reason !== 'string') return null;
      const attack = choice === 0 ? null : candidates[choice - 1];
      const odds = attack ? ` (${Math.round(attack.p * 100)}% odds)` : '';
      return { attack, candidates: heuristic.candidates, reason: `🧠 AI strategist: ${reason.slice(0, 200)}${odds}` };
    } catch (err) {
      if (err.status !== 429 && !/cooling down/.test(err.message)) console.warn(`AI strategist unavailable, using heuristic: ${err.message}`);
      return null;
    }
  }
}

module.exports = AiService;
