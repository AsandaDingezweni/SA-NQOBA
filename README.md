# SA-NQOBA

*Nqoba* is isiZulu and isiXhosa for "conquer". SA-NQOBA is a single-player, Risk-style world-conquest game built for the UCT INF4001N 2027 entrance exam (Geopolitics Game case study). You pick a nation, face nine random rival nations run by NPCs, and win by conquering all ten.

- **Web and mobile:** React Native with Expo SDK 58 and Expo Router. One codebase runs in the browser, on Android and on iOS.
- **API:** Node.js and Express 5, organised as models, services, controllers and routes, with a separate pure game engine.
- **Database:** MongoDB Atlas, through Mongoose.
- **AI:** OpenAI GPT-4o-mini provides live battle commentary and an optional NPC strategist. The game falls back to rule-based play when no key is configured.

## Submission details

| Item | Value |
| --- | --- |
| Deployed site | `<add your deployed URL>` |
| Demo login | `<username>` / `<password>` (create it on the Sign up page of the deployed site) |
| Database | MongoDB Atlas cluster, database `SANQOBA`. Add the examiners' emails as Atlas project members, or supply a read-only database user. |

## Running it locally

Prerequisites: Node.js 20 or later, and a MongoDB Atlas connection string.

```bash
cd backend
cp .env.example .env        # then fill in MONGO_URI, JWT_SECRET and optionally OPENAI_API_KEY
npm install
npm test                    # engine unit tests
npm start                   # API on http://localhost:5000
```

In a second terminal:

```bash
cd frontend
npm install
npx expo start --web        # web app on http://localhost:8081 (press a / i for Android / iOS)
```

The web app calls `http://localhost:5000` in development. Set `EXPO_PUBLIC_API_URL` to point it elsewhere.

With the server running, `node scripts/smoke-test.js` (from `backend/`) plays a real game over HTTP and checks the access-control and rule guarantees.

### Production build (one service)

```bash
cd frontend && npx expo export -p web     # writes frontend/dist
cd ../backend && npm start                # serves the API and the web app on one port
```

Express serves `frontend/dist` with a single-page-app fallback, so one Node web service (for example Render or Railway) hosts the whole application. Set `MONGO_URI`, `JWT_SECRET` and `OPENAI_API_KEY` as environment variables on the host.

## How the case-study rules map to the code

All rules live in `backend/engine/`, which has no Express or database code and is fully unit tested (`backend/tests/engine.test.js`).

| Rule | Where |
| --- | --- |
| Soldiers from population (1 to 9 by band) | `rules.soldierValueFor` |
| One country chosen, 9 random rivals, random turn order | `GameService.create`, `GameEngine.createInitialState` |
| Need 2 or more soldiers to attack; one attack per turn; attack any country | `GameEngine.startAttack` |
| Dice = min(attacker − 1, defender), paired in order, ties kill nobody | `Battle.resolveRound` |
| Keep rolling until conquered, attacker at 1, or stopped (stopping ends the turn) | `GameEngine.roll`, `stopAttack` |
| Conquest grants max(2, value ÷ 2), then choose soldiers to move in | `GameEngine.#conquer`, `occupy` |
| Transfers between your own countries, each keeping at least 1, never mid-attack | `GameEngine.transfer` |
| From round 2, 2 soldiers per country held, allocated freely | `GameEngine.#beginTurn`, `placeReinforcements` |
| Elimination, and skipped turns once eliminated | `GameEngine.#conquer`, `#advance` |
| Win by holding all 10 | `GameEngine.#checkGameOver` |

Every state change is appended to the game's `events` log with a board patch. That one log drives the animated battles, fast-forward, live spectating and replay.

### NPC behaviour

NPCs play to win. `NpcStrategy` scores every legal attack using the exact conquest probability (dynamic programming in `OddsCalculator`), the prize size, whether it weakens the leader, and whether it eliminates a rival. NPCs mass spare troops before striking, stop an attack when the odds drop below their limit, and split soldiers after a conquest. Each decision carries a written reason that appears in the war room log, including during fast-forward. Three personalities (Aggressive, Balanced, Defensive) tune the risk thresholds, and a patience rule lowers the bar after quiet turns so games never stall.

With an OpenAI key, the 🧠 AI strategist lets GPT-4o-mini choose among the engine's top legal options and justify the choice in character. It can never make an illegal move.

## Security and access control

- Passwords are hashed with bcrypt (12 rounds). Login uses JWT, with lockout after 5 failed attempts, and the error doesn't reveal whether a username exists.
- Every input is validated server-side (`middleware/validate.js`) and mirrored client-side.
- `helmet` headers, rate limiting on authentication and game commands, and a 20 kB JSON body limit.
- Anyone with a game link can watch it live (`GET /api/games/:id` is public). Only the logged-in owner can act in it; anyone else gets 403.
- Dice are rolled on the server with a CSPRNG. Optimistic concurrency stops two tabs from corrupting a game, and closing the browser mid-attack just resumes the attack.
- Secrets stay in `backend/.env`, which git ignores.

## Extra features

NPC personality profiles, the LLM NPC strategist, per-player and platform analytics with a leaderboard (MongoDB aggregation), step-by-step replay of any game, live spectating through shared links, fast-forward, and animated dice and board updates.

## Project layout

```
backend/
  engine/        pure game rules, battle, odds, NPC strategy (unit tested)
  models/        Mongoose schemas: User, Country, Game (collection "campaigns")
  services/      GameService, StatsService, AiService, FallbackCommentator
  controllers/   thin HTTP adapters
  routes/        REST routes with validation, auth and rate limits
  middleware/    auth (JWT), validation, error handling
  config/        environment and database connection, country seeding
  tests/ scripts/
frontend/src/
  app/           Expo Router screens: menu, login, register, new-game, games, game/[id], replay/[id], stats, rules
  components/    UI primitives and game components (CountryCard, Dice, BattlePanel, EventFeed, PlayerBoard)
  hooks/         useGameSession: loading, event playback, NPC driving, spectator polling
  lib/           API client, auth context, token storage, types
```
