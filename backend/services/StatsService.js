const mongoose = require('mongoose');
const Game = require('../models/Game');
const User = require('../models/User');
const Country = require('../models/Country');

const countIf = (expr) => ({ $sum: { $cond: [expr, 1, 0] } });
const humanPlayer = [{ $unwind: '$players' }, { $match: { 'players.kind': 'human' } }];
const sumStat = (field) => ({ $sum: `$players.stats.${field}` });

async function namesFor(codes) {
  const rows = await Country.find({ code: { $in: codes } }).select('code name iso2').lean();
  return new Map(rows.map((r) => [r.code, r]));
}

class StatsService {
  async forUser(userId) {
    const owner = new mongoose.Types.ObjectId(userId);
    const [result] = await Game.aggregate([
      { $match: { owner } },
      {
        $facet: {
          summary: [
            {
              $group: {
                _id: null,
                games: { $sum: 1 },
                won: countIf({ $eq: ['$status', 'won'] }),
                lost: countIf({ $eq: ['$status', 'lost'] }),
                active: countIf({ $eq: ['$status', 'active'] }),
                fastestWin: { $min: { $cond: [{ $eq: ['$status', 'won'] }, '$round', null] } },
              },
            },
          ],
          combat: [
            ...humanPlayer,
            {
              $group: {
                _id: null,
                attacks: sumStat('attacks'),
                conquests: sumStat('conquests'),
                rolls: sumStat('rolls'),
                soldiersKilled: sumStat('soldiersKilled'),
                soldiersLost: sumStat('soldiersLost'),
                reinforcements: sumStat('reinforcements'),
              },
            },
          ],
          startCountries: [
            ...humanPlayer,
            { $group: { _id: '$players.startCountry', games: { $sum: 1 }, wins: countIf({ $eq: ['$status', 'won'] }) } },
            { $sort: { games: -1, wins: -1 } },
            { $limit: 5 },
          ],
          conquered: [
            { $unwind: '$events' },
            { $match: { 'events.type': 'conquest', 'events.actor': 'human' } },
            { $group: { _id: '$events.data.to', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 },
          ],
          nemeses: [
            { $unwind: '$events' },
            { $match: { 'events.type': 'conquest', 'events.data.formerOwner': 'human' } },
            { $group: { _id: '$events.actor', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 },
          ],
        },
      },
    ]);

    const summary = result.summary[0] ?? { games: 0, won: 0, lost: 0, active: 0, fastestWin: null };
    const names = await namesFor([...result.startCountries, ...result.conquered, ...result.nemeses].map((r) => r._id));
    const label = (rows) => rows.map((r) => ({ code: r._id, name: names.get(r._id)?.name ?? r._id, iso2: names.get(r._id)?.iso2, ...r, _id: undefined }));
    const finished = summary.won + summary.lost;
    return {
      summary: { ...summary, _id: undefined, winRate: finished ? summary.won / finished : 0 },
      combat: { ...(result.combat[0] ?? { attacks: 0, conquests: 0, rolls: 0, soldiersKilled: 0, soldiersLost: 0, reinforcements: 0 }), _id: undefined },
      startCountries: label(result.startCountries),
      conquered: label(result.conquered),
      nemeses: label(result.nemeses),
    };
  }

  async platform() {
    const [[result], players] = await Promise.all([
      Game.aggregate([
        {
          $facet: {
            summary: [
              {
                $group: {
                  _id: null,
                  games: { $sum: 1 },
                  won: countIf({ $eq: ['$status', 'won'] }),
                  lost: countIf({ $eq: ['$status', 'lost'] }),
                  active: countIf({ $eq: ['$status', 'active'] }),
                  avgRoundsToWin: { $avg: { $cond: [{ $eq: ['$status', 'won'] }, '$round', null] } },
                  battles: { $sum: { $size: { $filter: { input: '$events', cond: { $eq: ['$$this.type', 'attack_start'] } } } } },
                  diceRolls: { $sum: { $size: { $filter: { input: '$events', cond: { $eq: ['$$this.type', 'roll'] } } } } },
                },
              },
            ],
            popularCountries: [
              ...humanPlayer,
              { $group: { _id: '$players.startCountry', games: { $sum: 1 }, wins: countIf({ $eq: ['$status', 'won'] }) } },
              { $sort: { games: -1 } },
              { $limit: 6 },
            ],
            npcProfiles: [
              { $match: { status: 'lost' } },
              { $project: { winner: { $first: { $filter: { input: '$players', cond: { $eq: ['$$this.pid', '$winner'] } } } } } },
              { $group: { _id: '$winner.profile', victories: { $sum: 1 } } },
              { $sort: { victories: -1 } },
            ],
            leaderboard: [
              { $group: { _id: '$owner', name: { $first: '$ownerName' }, games: { $sum: 1 }, wins: countIf({ $eq: ['$status', 'won'] }) } },
              { $sort: { wins: -1, games: 1 } },
              { $limit: 10 },
            ],
          },
        },
      ]),
      User.estimatedDocumentCount(),
    ]);
    const summary = result.summary[0] ?? { games: 0, won: 0, lost: 0, active: 0, avgRoundsToWin: null, battles: 0, diceRolls: 0 };
    const names = await namesFor(result.popularCountries.map((r) => r._id));
    const finished = summary.won + summary.lost;
    return {
      summary: { ...summary, _id: undefined, players, humanWinRate: finished ? summary.won / finished : 0 },
      popularCountries: result.popularCountries.map((r) => ({ code: r._id, name: names.get(r._id)?.name ?? r._id, iso2: names.get(r._id)?.iso2, games: r.games, wins: r.wins })),
      npcProfiles: result.npcProfiles.filter((r) => r._id).map((r) => ({ profile: r._id, victories: r.victories })),
      leaderboard: result.leaderboard.map((r) => ({ name: r.name, games: r.games, wins: r.wins, winRate: r.games ? r.wins / r.games : 0 })),
    };
  }
}

module.exports = StatsService;
