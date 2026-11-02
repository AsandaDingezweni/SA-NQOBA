const express = require('express');
const router = express.Router();
const Game = require('../models/Game');

// Helper: Definition of the 10 South African Economic Zones
const BASE_TERRITORIES = [
  {
    id: 'gauteng',
    name: 'Gauteng',
    troops: 12,
    defensiveBonus: false,
    adjacentTerritories: ['north_west', 'free_state', 'mpumalanga', 'limpopo'],
  },
  {
    id: 'western_cape',
    name: 'Western Cape',
    troops: 8,
    defensiveBonus: true, // Defensive Bonus: attackers roll 1 less die
    adjacentTerritories: ['eastern_cape', 'northern_cape', 'ocean_eez'],
  },
  {
    id: 'kzn',
    name: 'KwaZulu-Natal',
    troops: 9,
    defensiveBonus: false,
    adjacentTerritories: ['mpumalanga', 'free_state', 'eastern_cape', 'ocean_eez'],
  },
  {
    id: 'eastern_cape',
    name: 'Eastern Cape',
    troops: 7,
    defensiveBonus: false,
    adjacentTerritories: ['western_cape', 'free_state', 'kzn', 'ocean_eez'],
  },
  {
    id: 'limpopo',
    name: 'Limpopo',
    troops: 7,
    defensiveBonus: false,
    adjacentTerritories: ['gauteng', 'mpumalanga', 'north_west'],
  },
  {
    id: 'mpumalanga',
    name: 'Mpumalanga',
    troops: 6,
    defensiveBonus: false,
    adjacentTerritories: ['gauteng', 'limpopo', 'kzn', 'free_state'],
  },
  {
    id: 'north_west',
    name: 'North West',
    troops: 6,
    defensiveBonus: false,
    adjacentTerritories: ['gauteng', 'limpopo', 'free_state', 'northern_cape'],
  },
  {
    id: 'free_state',
    name: 'Free State',
    troops: 6,
    defensiveBonus: false,
    adjacentTerritories: ['gauteng', 'north_west', 'northern_cape', 'eastern_cape', 'kzn', 'mpumalanga'],
  },
  {
    id: 'northern_cape',
    name: 'Northern Cape',
    troops: 4,
    defensiveBonus: false,
    adjacentTerritories: ['western_cape', 'free_state', 'north_west', 'ocean_eez'],
  },
  {
    id: 'ocean_eez',
    name: 'Ocean / EEZ',
    troops: 5,
    defensiveBonus: false,
    adjacentTerritories: ['western_cape', 'eastern_cape', 'kzn', 'northern_cape'],
  },
];

const NPC_FACTIONS = ['Soweto Syndicate', 'Cape Cartel', 'Zulu Dynasty'];

// POST /api/game/start - Initialize a new campaign
router.post('/start', async (req, res) => {
  try {
    const { userId = 'guest', playerStartingTerritory = 'gauteng' } = req.body;

    // Shuffle remaining territories and assign owners
    const territories = BASE_TERRITORIES.map((zone) => {
      let owner = 'Player';
      if (zone.id !== playerStartingTerritory) {
        // Distribute remaining territories among NPC factions
        const npcIndex = Math.floor(Math.random() * NPC_FACTIONS.length);
        owner = NPC_FACTIONS[npcIndex];
      }
      return {
        id: zone.id,
        name: zone.name,
        troops: zone.troops,
        defensiveBonus: zone.defensiveBonus,
        adjacentTerritories: [...zone.adjacentTerritories],
        owner,
      };
    });

    const selectedPlayerZone = territories.find((t) => t.id === playerStartingTerritory) || territories[0];
    selectedPlayerZone.owner = 'Player';

    // Create initial battle log
    const battleLog = [
      {
        message: '🎮 SA-NQOBA Campaign Initialized!',
        type: 'system',
        timestamp: new Date(),
      },
      {
        message: `Commander assigned starting base in ${selectedPlayerZone.name} with ${selectedPlayerZone.troops} troops.`,
        type: 'info',
        timestamp: new Date(),
      },
      {
        message: 'Rule: Western Cape gives defensive advantage (Attackers roll 1 less die).',
        type: 'info',
        timestamp: new Date(),
      },
      {
        message: 'Roll the Ludo Command Die to begin your strategic operations!',
        type: 'dice',
        timestamp: new Date(),
      },
    ];

    const newGame = new Game({
      userId,
      status: 'in_progress',
      currentTurn: 'Player',
      turnNumber: 1,
      actionsRemaining: 0, // Must roll command die first
      consecutiveSixes: 0,
      lastDiceRoll: null,
      territories,
      battleLog,
    });

    const savedGame = await newGame.save();

    res.status(201).json({
      success: true,
      message: 'Game state initialized successfully',
      game: savedGame,
    });
  } catch (error) {
    console.error('Error starting game:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initialize game state',
      error: error.message,
    });
  }
});

// GET /api/game/:id - Fetch current game state
router.get('/:id', async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    if (!game) {
      return res.status(404).json({ success: false, message: 'Game not found' });
    }
    res.json({ success: true, game });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// POST /api/game/roll-dice - Roll the Ludo Command Die
router.post('/roll-dice', async (req, res) => {
  try {
    const { gameId } = req.body;
    const game = await Game.findById(gameId);
    if (!game) return res.status(404).json({ success: false, message: 'Game not found' });

    if (game.currentTurn !== 'Player') {
      return res.status(400).json({ success: false, message: 'Not player turn' });
    }

    const roll = Math.floor(Math.random() * 6) + 1;
    let actionsGained = 0;
    let consecutiveSixes = game.consecutiveSixes;
    let turnOverheated = false;

    if (roll === 6) {
      consecutiveSixes += 1;
      if (consecutiveSixes >= 3) {
        // Triple 6 Penalty: Overheat forfeit!
        turnOverheated = true;
        game.consecutiveSixes = 0;
        game.actionsRemaining = 0;
        game.currentTurn = 'NPC Factions';
        game.battleLog.unshift({
          message: '🔥 TRIPLE 6 OVERHEAT! Command dice overheated. Turn forfeited to NPCs!',
          type: 'warning',
          timestamp: new Date(),
        });
      } else {
        actionsGained = 1;
        game.actionsRemaining += actionsGained;
        game.consecutiveSixes = consecutiveSixes;
        game.battleLog.unshift({
          message: `🎲 Rolled a 6! BLITZ BONUS! (+1 Extra Action, total actions: ${game.actionsRemaining})`,
          type: 'dice',
          timestamp: new Date(),
        });
      }
    } else {
      consecutiveSixes = 0;
      actionsGained = 1;
      game.actionsRemaining += actionsGained;
      game.consecutiveSixes = 0;
      game.battleLog.unshift({
        message: `🎲 Rolled a ${roll}. (+1 Action granted, total actions: ${game.actionsRemaining})`,
        type: 'dice',
        timestamp: new Date(),
      });
    }

    game.lastDiceRoll = roll;
    await game.save();

    res.json({
      success: true,
      roll,
      turnOverheated,
      actionsRemaining: game.actionsRemaining,
      consecutiveSixes: game.consecutiveSixes,
      game,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// POST /api/game/attack - Resolve Combat
router.post('/attack', async (req, res) => {
  try {
    const { gameId, attackerId, defenderId } = req.body;
    const game = await Game.findById(gameId);
    if (!game) return res.status(404).json({ success: false, message: 'Game not found' });

    if (game.actionsRemaining <= 0) {
      return res.status(400).json({ success: false, message: 'No actions remaining. Roll command die first!' });
    }

    const attacker = game.territories.find((t) => t.id === attackerId);
    const defender = game.territories.find((t) => t.id === defenderId);

    if (!attacker || !defender) {
      return res.status(400).json({ success: false, message: 'Invalid territories selected' });
    }

    if (attacker.owner !== 'Player' || defender.owner === 'Player') {
      return res.status(400).json({ success: false, message: 'Invalid combatants' });
    }

    if (attacker.troops <= 1) {
      return res.status(400).json({ success: false, message: 'Attacker must have at least 2 troops to launch an attack' });
    }

    if (!attacker.adjacentTerritories.includes(defenderId)) {
      return res.status(400).json({ success: false, message: 'Territories are not connected by economic trade routes' });
    }

    // Risk Combat Rules
    // Attacker rolls up to Math.min(3, attacker.troops - 1)
    let maxAttackerDice = Math.min(3, attacker.troops - 1);
    if (defender.defensiveBonus) {
      maxAttackerDice = Math.max(1, maxAttackerDice - 1); // Western Cape defensive bonus
    }

    const maxDefenderDice = Math.min(3, defender.troops);

    const attackerDice = Array.from({ length: maxAttackerDice }, () => Math.floor(Math.random() * 6) + 1).sort((a, b) => b - a);
    const defenderDice = Array.from({ length: maxDefenderDice }, () => Math.floor(Math.random() * 6) + 1).sort((a, b) => b - a);

    let attackerLosses = 0;
    let defenderLosses = 0;

    const comparisons = Math.min(attackerDice.length, defenderDice.length);
    for (let i = 0; i < comparisons; i++) {
      if (attackerDice[i] > defenderDice[i]) {
        defenderLosses++;
      } else {
        attackerLosses++;
      }
    }

    attacker.troops -= attackerLosses;
    defender.troops -= defenderLosses;

    let conquered = false;
    let conqueredReward = 0;

    if (defender.troops <= 0) {
      conquered = true;
      const originalDefenderTroops = defender.troops + defenderLosses;
      conqueredReward = Math.max(2, Math.floor(originalDefenderTroops / 2));
      const formerOwner = defender.owner;

      defender.owner = 'Player';
      defender.troops = conqueredReward;
      attacker.troops = Math.max(1, attacker.troops - 1);

      game.battleLog.unshift({
        message: `🏆 CONQUEST! ${attacker.name} conquered ${defender.name} from ${formerOwner}! Claimed ${conqueredReward} bonus troops.`,
        type: 'conquest',
        timestamp: new Date(),
      });
    } else {
      game.battleLog.unshift({
        message: `⚔️ Battle in ${defender.name}: Attacker [${attackerDice.join(',')}] vs Defender [${defenderDice.join(',')}]. Losses - Player: -${attackerLosses}, Defender: -${defenderLosses}`,
        type: 'combat',
        timestamp: new Date(),
      });
    }

    game.actionsRemaining = Math.max(0, game.actionsRemaining - 1);

    // Check Win Condition
    const allPlayer = game.territories.every((t) => t.owner === 'Player');
    if (allPlayer) {
      game.status = 'won';
      game.battleLog.unshift({
        message: '🎉 VICTORY! You have conquered all 10 economic zones of South Africa!',
        type: 'system',
        timestamp: new Date(),
      });
    }

    await game.save();

    res.json({
      success: true,
      attackerDice,
      defenderDice,
      attackerLosses,
      defenderLosses,
      conquered,
      conqueredReward,
      game,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

module.exports = router;
