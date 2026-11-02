const { HUMAN_PID } = require('../engine/rules');

// Thin HTTP adapter: parse request, call the service, shape the response.
function createGameController(gameService) {
  const act = (command) => async (req, res) => {
    res.json(await gameService.act(req.params.id, req.user, (engine) => command(engine, req.valid ?? {})));
  };

  return {
    async create(req, res) {
      const game = await gameService.create(req.user, req.valid);
      res.status(201).json({ game: game.toView() });
    },

    async show(req, res) {
      const game = await gameService.get(req.params.id);
      res.json({ game: game.toView({ since: req.valid.since }), viewerIsOwner: Boolean(req.user && game.owner.equals(req.user.id)) });
    },

    async listMine(req, res) {
      res.json(await gameService.list({ ...req.valid, ownerId: req.user.id }));
    },

    async listPublic(req, res) {
      res.json(await gameService.list(req.valid));
    },

    reinforce: act((engine, { allocations }) => engine.placeReinforcements(HUMAN_PID, allocations)),
    transfer: act((engine, { from, to, soldiers }) => engine.transfer(HUMAN_PID, from, to, soldiers)),
    attack: act((engine, { from, to }) => engine.startAttack(HUMAN_PID, from, to)),
    roll: act((engine) => engine.roll(HUMAN_PID)),
    stop: act((engine) => engine.stopAttack(HUMAN_PID)),
    occupy: act((engine, { soldiers }) => engine.occupy(HUMAN_PID, soldiers)),
    endTurn: act((engine) => engine.endTurn(HUMAN_PID)),
    forfeit: act((engine) => engine.forfeit(HUMAN_PID)),

    async advance(req, res) {
      res.json(await gameService.advance(req.params.id, req.user));
    },
  };
}

module.exports = createGameController;
