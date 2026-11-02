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

## Running it on a new computer

You need two things:

1. **Node.js 20.19 or later** (22 LTS recommended) from https://nodejs.org. npm comes with it.
2. **An internet connection** for the first install. All packages download automatically; the zip deliberately contains no `node_modules` folders.

On Windows, unzip to a short path such as `C:\SA-NQOBA` and not inside OneDrive. React Native packages nest deeply, and a long parent path pushes them past Windows' 260-character path limit. When that happens, `npm install` fails with `ENOENT: mkdir … File exists` or `EPERM`. OneDrive folders also make installs and builds much slower.

Then, from the project folder (the one containing this README):

```bash
npm install          # installs the root, backend/ and frontend/ packages (a few minutes the first time)
```

Create `backend/.env` by copying `backend/.env.example` and filling in the values. The server refuses to start without `MONGO_URI` and `JWT_SECRET`, and its error message says which one is missing. `OPENAI_API_KEY` is optional: without it the game runs with the built-in commentator and NPC strategy.

```bash
npm test             # engine unit tests, no database needed
npm run build        # builds the web app into frontend/dist
npm start            # API + web app together on http://localhost:5000
```

Open **http://localhost:5000**, sign up, and start a campaign. To check the whole stack over HTTP, run `npm run smoke` in a second terminal while the server is running.

If the database connection fails, the MongoDB Atlas cluster must allow the computer's IP address: in Atlas, open Network Access and add the current IP address, or `0.0.0.0/0` for "allow from anywhere".

### Developer mode (hot reload)

Use two terminals: `npm run dev:api` (API on :5000) and `npm run dev:web` (Expo on http://localhost:8081, which calls the API on :5000). Set `EXPO_PUBLIC_API_URL` to point the app at another API. In the Expo terminal, press `a` for Android or `i` for iOS.

### Deploying

`npm run build` followed by `npm start` serves the API and the web app from one Node process, so any Node host (Render, Railway, a VM) runs the whole application as a single web service. Set `MONGO_URI`, `JWT_SECRET`, `OPENAI_API_KEY` and optionally `PORT` as environment variables on the host instead of a `.env` file. Use `npm install` as the install command, `npm run build` as the build command, and `npm start` as the start command.

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
