// End-to-end check of a running server: node scripts/smoke-test.js [baseUrl]
const assert = require('node:assert/strict');

const BASE = (process.argv[2] ?? 'http://localhost:5000').replace(/\/$/, '') + '/api';

async function call(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

async function register(prefix) {
  const username = `${prefix}${Date.now().toString(36)}`;
  const r = await call('POST', '/auth/register', { body: { username, password: 'Conquer2027' } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body.token;
}

(async () => {
  const health = await call('GET', '/health');
  console.log('health', health.body);

  const filtered = await call('GET', '/countries?region=Africa&minSoldiers=4&sort=soldiers');
  assert.ok(filtered.body.countries.every((c) => c.region === 'Africa' && c.soldiers >= 4), 'country filter');
  const searched = await call('GET', '/countries?search=south');
  assert.ok(searched.body.countries.some((c) => c.code === 'ZAF'), 'country search');

  assert.equal((await call('POST', '/auth/register', { body: { username: 'x', password: 'short' } })).status, 422, 'validation');
  const token = await register('smoke');
  const intruder = await register('spy');
  assert.equal((await call('POST', '/auth/login', { body: { username: 'nobody_here', password: 'Wrong12345' } })).status, 401);

  assert.equal((await call('POST', '/games', { body: { countryCode: 'ZAF' } })).status, 401, 'must log in to start');
  const created = await call('POST', '/games', { token, body: { countryCode: 'ZAF', npcProfile: 'mixed' } });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  let game = created.body.game;
  const id = game.id;
  console.log('created', id, 'order', game.turnOrder.join(','));

  const spectator = await call('GET', `/games/${id}`);
  assert.equal(spectator.status, 200, 'spectators can watch');
  assert.equal(spectator.body.viewerIsOwner, false);
  assert.equal((await call('POST', `/games/${id}/end-turn`, { token: intruder })).status, 403, 'visitor cannot play');

  const npcReasons = [];
  const drive = async () => {
    while (game.status === 'active' && game.currentPid !== 'human') {
      const r = await call('POST', `/games/${id}/advance`, { token });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      game = r.body.game;
      npcReasons.push(...r.body.events.filter((e) => e.reason).map((e) => `${e.actor}: ${e.reason}`));
    }
  };

  for (let turn = 0; turn < 6 && game.status === 'active'; turn++) {
    await drive();
    if (game.status !== 'active') break;
    const mine = game.countries.filter((c) => c.owner === 'human');
    if (game.phase === 'reinforce') {
      game = (await call('POST', `/games/${id}/reinforce`, { token, body: { allocations: { [mine[0].code]: game.pendingReinforcements } } })).body.game;
    }
    const source = game.countries.filter((c) => c.owner === 'human').sort((a, b) => b.soldiers - a.soldiers)[0];
    const target = game.countries.filter((c) => c.owner !== 'human').sort((a, b) => a.soldiers - b.soldiers)[0];
    if (source.soldiers >= 2) {
      let r = await call('POST', `/games/${id}/attack`, { token, body: { from: source.code, to: target.code } });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal((await call('POST', `/games/${id}/attack`, { token, body: { from: source.code, to: target.code } })).status, 409, 'one attack per turn');
      game = r.body.game;
      while (game.phase === 'attacking') {
        r = await call('POST', `/games/${id}/roll`, { token });
        assert.equal(r.status, 200, JSON.stringify(r.body));
        game = r.body.game;
        const roll = r.body.events.find((e) => e.type === 'roll');
        console.log(`  roll ${roll.dice.attacker} vs ${roll.dice.defender} | ${roll.commentarySource}: ${roll.commentary}`);
      }
      if (game.phase === 'occupy') game = (await call('POST', `/games/${id}/occupy`, { token, body: { soldiers: game.pendingOccupy.max } })).body.game;
    }
    if (game.status === 'active') game = (await call('POST', `/games/${id}/end-turn`, { token })).body.game;
  }
  await drive();

  const full = await call('GET', `/games/${id}`, { token });
  assert.equal(full.body.viewerIsOwner, true);
  const since = await call('GET', `/games/${id}?since=${full.body.game.eventSeq - 3}`);
  assert.equal(since.body.game.events.length, 3, 'incremental polling');
  console.log(`round ${game.round}, ${full.body.game.events.length} events, status ${game.status}`);
  console.log('sample NPC reasons:\n ', npcReasons.slice(0, 5).join('\n  '));

  const mine = await call('GET', '/games/mine?status=active', { token });
  assert.ok(mine.body.items.length >= (game.status === 'active' ? 1 : 0));
  const stats = await call('GET', '/stats/me', { token });
  assert.equal(stats.status, 200, JSON.stringify(stats.body));
  const platform = await call('GET', '/stats/platform');
  assert.equal(platform.status, 200, JSON.stringify(platform.body));
  console.log('my stats', JSON.stringify(stats.body.combat), '| platform games', platform.body.summary.games);
  console.log('SMOKE TEST PASSED');
})().catch((err) => {
  console.error('SMOKE TEST FAILED:', err.message);
  process.exit(1);
});
