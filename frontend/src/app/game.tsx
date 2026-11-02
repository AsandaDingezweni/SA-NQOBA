import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS } from '../../theme';

// Type definitions for Territory and Battle Log
export interface Territory {
  id: string;
  name: string;
  owner: string; // 'Player', 'Soweto Syndicate', 'Cape Cartel', 'Zulu Dynasty'
  troops: number;
  defensiveBonus: boolean;
  adjacentTerritories: string[];
}

export interface BattleLogItem {
  id: string;
  message: string;
  type: 'info' | 'dice' | 'combat' | 'reinforcement' | 'warning' | 'conquest' | 'system';
  timestamp: string;
}

export interface GameState {
  _id?: string;
  userId: string;
  status: 'in_progress' | 'won' | 'lost';
  currentTurn: string;
  turnNumber: number;
  actionsRemaining: number;
  consecutiveSixes: number;
  lastDiceRoll: number | null;
  territories: Territory[];
  battleLog: BattleLogItem[];
}

// Fallback economic zones if API is offline
const INITIAL_TERRITORIES: Territory[] = [
  {
    id: 'gauteng',
    name: 'Gauteng',
    owner: 'Player',
    troops: 12,
    defensiveBonus: false,
    adjacentTerritories: ['north_west', 'free_state', 'mpumalanga', 'limpopo'],
  },
  {
    id: 'western_cape',
    name: 'Western Cape',
    owner: 'Cape Cartel',
    troops: 8,
    defensiveBonus: true,
    adjacentTerritories: ['eastern_cape', 'northern_cape', 'ocean_eez'],
  },
  {
    id: 'kzn',
    name: 'KwaZulu-Natal',
    owner: 'Zulu Dynasty',
    troops: 9,
    defensiveBonus: false,
    adjacentTerritories: ['mpumalanga', 'free_state', 'eastern_cape', 'ocean_eez'],
  },
  {
    id: 'eastern_cape',
    name: 'Eastern Cape',
    owner: 'Cape Cartel',
    troops: 7,
    defensiveBonus: false,
    adjacentTerritories: ['western_cape', 'free_state', 'kzn', 'ocean_eez'],
  },
  {
    id: 'limpopo',
    name: 'Limpopo',
    owner: 'Soweto Syndicate',
    troops: 7,
    defensiveBonus: false,
    adjacentTerritories: ['gauteng', 'mpumalanga', 'north_west'],
  },
  {
    id: 'mpumalanga',
    name: 'Mpumalanga',
    owner: 'Soweto Syndicate',
    troops: 6,
    defensiveBonus: false,
    adjacentTerritories: ['gauteng', 'limpopo', 'kzn', 'free_state'],
  },
  {
    id: 'north_west',
    name: 'North West',
    owner: 'Soweto Syndicate',
    troops: 6,
    defensiveBonus: false,
    adjacentTerritories: ['gauteng', 'limpopo', 'free_state', 'northern_cape'],
  },
  {
    id: 'free_state',
    name: 'Free State',
    owner: 'Zulu Dynasty',
    troops: 6,
    defensiveBonus: false,
    adjacentTerritories: ['gauteng', 'north_west', 'northern_cape', 'eastern_cape', 'kzn', 'mpumalanga'],
  },
  {
    id: 'northern_cape',
    name: 'Northern Cape',
    owner: 'Cape Cartel',
    troops: 4,
    defensiveBonus: false,
    adjacentTerritories: ['western_cape', 'free_state', 'north_west', 'ocean_eez'],
  },
  {
    id: 'ocean_eez',
    name: 'Ocean / EEZ',
    owner: 'Zulu Dynasty',
    troops: 5,
    defensiveBonus: false,
    adjacentTerritories: ['western_cape', 'eastern_cape', 'kzn', 'northern_cape'],
  },
];

const API_BASE_URL = 'http://localhost:5000/api/game';

export default function GameScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const [loading, setLoading] = useState<boolean>(true);
  const [game, setGame] = useState<GameState>({
    userId: 'guest',
    status: 'in_progress',
    currentTurn: 'Player',
    turnNumber: 1,
    actionsRemaining: 0,
    consecutiveSixes: 0,
    lastDiceRoll: null,
    territories: INITIAL_TERRITORIES,
    battleLog: [
      {
        id: '1',
        message: '🎮 SA-NQOBA Campaign initialized!',
        type: 'system',
        timestamp: new Date().toLocaleTimeString(),
      },
      {
        id: '2',
        message: 'Roll the Ludo Command Die to earn turn actions!',
        type: 'dice',
        timestamp: new Date().toLocaleTimeString(),
      },
    ],
  });

  const [selectedAttackerId, setSelectedAttackerId] = useState<string | null>(null);
  const [selectedDefenderId, setSelectedDefenderId] = useState<string | null>(null);
  const [rolling, setRolling] = useState<boolean>(false);
  const [lastCombatDice, setLastCombatDice] = useState<{ attacker: number[]; defender: number[] } | null>(null);

  // Initialize Game from MongoDB Backend
  const initializeGame = useCallback(async () => {
    setLoading(true);
    setSelectedAttackerId(null);
    setSelectedDefenderId(null);
    try {
      const response = await fetch(`${API_BASE_URL}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'guest', playerStartingTerritory: 'gauteng' }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.game) {
          setGame(data.game);
        }
      } else {
        console.warn('Backend start returned non-OK, using offline state.');
      }
    } catch (error) {
      console.warn('Could not connect to MongoDB backend, initializing client-side state:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    initializeGame();
  }, [initializeGame]);

  // Handle Ludo Command Die Roll
  const handleRollDice = async () => {
    if (game.actionsRemaining > 0 && !confirm('You still have actions remaining! Roll again for potential Blitz extra action?')) {
      return;
    }

    setRolling(true);

    if (game._id) {
      try {
        const response = await fetch(`${API_BASE_URL}/roll-dice`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gameId: game._id }),
        });
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.game) {
            setGame(data.game);
            setRolling(false);
            return;
          }
        }
      } catch (err) {
        console.warn('Backend roll failed, processing locally:', err);
      }
    }

    // Local Fallback Dice Roll Logic
    const roll = Math.floor(Math.random() * 6) + 1;
    let consecutive = game.consecutiveSixes;
    let actions = game.actionsRemaining;
    const newLogs = [...game.battleLog];

    if (roll === 6) {
      consecutive += 1;
      if (consecutive >= 3) {
        // Triple 6 Overheat penalty
        actions = 0;
        consecutive = 0;
        newLogs.unshift({
          id: Date.now().toString(),
          message: '🔥 TRIPLE 6 OVERHEAT! Command dice overheated. Turn forfeited!',
          type: 'warning',
          timestamp: new Date().toLocaleTimeString(),
        });
      } else {
        actions += 1;
        newLogs.unshift({
          id: Date.now().toString(),
          message: `🎲 Rolled a 6! BLITZ BONUS! (+1 Extra Action, total: ${actions})`,
          type: 'dice',
          timestamp: new Date().toLocaleTimeString(),
        });
      }
    } else {
      consecutive = 0;
      actions += 1;
      newLogs.unshift({
        id: Date.now().toString(),
        message: `🎲 Rolled a ${roll}. (+1 Action granted, total: ${actions})`,
        type: 'dice',
        timestamp: new Date().toLocaleTimeString(),
      });
    }

    setGame((prev) => ({
      ...prev,
      lastDiceRoll: roll,
      actionsRemaining: actions,
      consecutiveSixes: consecutive,
      battleLog: newLogs,
    }));
    setRolling(false);
  };

  // Handle Territory Tap
  const handleTerritoryPress = (territory: Territory) => {
    if (territory.owner === 'Player') {
      if (selectedAttackerId === territory.id) {
        // Deselect
        setSelectedAttackerId(null);
        setSelectedDefenderId(null);
      } else {
        // Select as Attacker
        setSelectedAttackerId(territory.id);
        setSelectedDefenderId(null);
      }
    } else {
      // Tapped Enemy Territory
      if (selectedAttackerId) {
        const attacker = game.territories.find((t) => t.id === selectedAttackerId);
        if (attacker && attacker.adjacentTerritories.includes(territory.id)) {
          setSelectedDefenderId(territory.id);
        } else {
          alert(`${territory.name} is not connected by an economic trade route to ${attacker?.name}!`);
        }
      } else {
        alert('Select your own territory first as the attacker!');
      }
    }
  };

  // Handle Combat Execution
  const handleExecuteAttack = async () => {
    if (!selectedAttackerId || !selectedDefenderId) return;
    if (game.actionsRemaining <= 0) {
      alert('No actions remaining! Roll the Ludo Command Die to get turn actions.');
      return;
    }

    const attacker = game.territories.find((t) => t.id === selectedAttackerId);
    const defender = game.territories.find((t) => t.id === selectedDefenderId);

    if (!attacker || !defender) return;
    if (attacker.troops <= 1) {
      alert('You need at least 2 troops in a territory to launch an attack!');
      return;
    }

    if (game._id) {
      try {
        const response = await fetch(`${API_BASE_URL}/attack`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gameId: game._id,
            attackerId: attacker.id,
            defenderId: defender.id,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.game) {
            setGame(data.game);
            setLastCombatDice({ attacker: data.attackerDice, defender: data.defenderDice });
            if (data.conquered) {
              setSelectedAttackerId(null);
              setSelectedDefenderId(null);
            }
            return;
          }
        }
      } catch (error) {
        console.warn('Backend attack failed, running local combat:', error);
      }
    }

    // Local Combat Resolution
    let maxAttackerDice = Math.min(3, attacker.troops - 1);
    if (defender.defensiveBonus) {
      maxAttackerDice = Math.max(1, maxAttackerDice - 1); // Western Cape defensive penalty
    }
    const maxDefenderDice = Math.min(3, defender.troops);

    const attDice = Array.from({ length: maxAttackerDice }, () => Math.floor(Math.random() * 6) + 1).sort((a, b) => b - a);
    const defDice = Array.from({ length: maxDefenderDice }, () => Math.floor(Math.random() * 6) + 1).sort((a, b) => b - a);

    let attLoss = 0;
    let defLoss = 0;
    const comps = Math.min(attDice.length, defDice.length);
    for (let i = 0; i < comps; i++) {
      if (attDice[i] > defDice[i]) defLoss++;
      else attLoss++;
    }

    setLastCombatDice({ attacker: attDice, defender: defDice });

    const updatedTerritories = game.territories.map((t) => {
      if (t.id === attacker.id) {
        return { ...t, troops: t.troops - attLoss };
      }
      if (t.id === defender.id) {
        const newTroops = t.troops - defLoss;
        if (newTroops <= 0) {
          const reward = Math.max(2, Math.floor((t.troops + defLoss) / 2));
          return { ...t, owner: 'Player', troops: reward };
        }
        return { ...t, troops: newTroops };
      }
      return t;
    });

    const isConquered = updatedTerritories.find((t) => t.id === defender.id)?.owner === 'Player';
    const updatedLogs = [...game.battleLog];

    if (isConquered) {
      updatedLogs.unshift({
        id: Date.now().toString(),
        message: `🏆 CONQUEST! ${attacker.name} conquered ${defender.name}!`,
        type: 'conquest',
        timestamp: new Date().toLocaleTimeString(),
      });
      setSelectedAttackerId(null);
      setSelectedDefenderId(null);
    } else {
      updatedLogs.unshift({
        id: Date.now().toString(),
        message: `⚔️ Battle in ${defender.name}: Attacker [${attDice.join(',')}] vs Defender [${defDice.join(',')}]. Losses - Player: -${attLoss}, Defender: -${defLoss}`,
        type: 'combat',
        timestamp: new Date().toLocaleTimeString(),
      });
    }

    setGame((prev) => ({
      ...prev,
      actionsRemaining: Math.max(0, prev.actionsRemaining - 1),
      territories: updatedTerritories,
      battleLog: updatedLogs,
    }));
  };

  const getOwnerColor = (owner: string) => {
    if (owner === 'Player') return COLORS.mossGreen;
    if (owner === 'Soweto Syndicate') return '#C0392B';
    if (owner === 'Cape Cartel') return '#8E44AD';
    if (owner === 'Zulu Dynasty') return '#D35400';
    return COLORS.charcoal;
  };

  const playerTerritories = game.territories.filter((t) => t.owner === 'Player');
  const totalPlayerTroops = playerTerritories.reduce((acc, curr) => acc + curr.troops, 0);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.mossGreen} />
        <Text style={styles.loadingText}>Initializing South African Battlefield...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header Bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.push('/menu' as any)} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Menu</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SA-NQOBA MAP</Text>
        <TouchableOpacity onPress={initializeGame} style={styles.resetButton}>
          <Text style={styles.resetButtonText}>Restart</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.mainWrapper, isDesktop && styles.mainWrapperDesktop]}>
          {/* Status Bar Banner */}
          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <Text style={styles.statusStat}>
                🏛️ Player Territories: <Text style={styles.boldText}>{playerTerritories.length} / 10</Text>
              </Text>
              <Text style={styles.statusStat}>
                ⚔️ Total Army: <Text style={styles.boldText}>{totalPlayerTroops}</Text>
              </Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusStat}>
                ⚡ Actions Left: <Text style={styles.boldText}>{game.actionsRemaining}</Text>
              </Text>
              {game.lastDiceRoll !== null && (
                <Text style={styles.statusStat}>
                  🎲 Last Roll: <Text style={styles.boldText}>{game.lastDiceRoll}</Text>
                </Text>
              )}
            </View>
          </View>

          {/* Command Controls Panel */}
          <View style={styles.commandPanel}>
            <TouchableOpacity
              style={[styles.diceButton, rolling && styles.disabledButton]}
              onPress={handleRollDice}
              disabled={rolling}
            >
              <Text style={styles.diceButtonText}>
                {rolling ? 'Rolling...' : `🎲 ROLL COMMAND DIE (${game.actionsRemaining} Actions)`}
              </Text>
            </TouchableOpacity>

            {selectedAttackerId && selectedDefenderId && (
              <TouchableOpacity style={styles.attackButton} onPress={handleExecuteAttack}>
                <Text style={styles.attackButtonText}>
                  ⚔️ LAUNCH ATTACK ON {game.territories.find((t) => t.id === selectedDefenderId)?.name.toUpperCase()}
                </Text>
              </TouchableOpacity>
            )}

            {lastCombatDice && (
              <View style={styles.combatDiceBadge}>
                <Text style={styles.combatDiceText}>
                  Attacker Dice: [{lastCombatDice.attacker.join(', ')}] vs Defender Dice: [{lastCombatDice.defender.join(', ')}]
                </Text>
              </View>
            )}
          </View>

          {/* Interactive Territory Nodes */}
          <Text style={styles.sectionTitle}>ECONOMIC ZONES (TAP TO SELECT & ATTACK)</Text>
          <View style={styles.territoriesGrid}>
            {game.territories.map((territory) => {
              const isSelectedAttacker = selectedAttackerId === territory.id;
              const isSelectedDefender = selectedDefenderId === territory.id;
              const ownerBgColor = getOwnerColor(territory.owner);

              return (
                <TouchableOpacity
                  key={territory.id}
                  style={[
                    styles.territoryCard,
                    { borderTopColor: ownerBgColor },
                    isSelectedAttacker && styles.attackerCardSelected,
                    isSelectedDefender && styles.defenderCardSelected,
                  ]}
                  onPress={() => handleTerritoryPress(territory)}
                  activeOpacity={0.8}
                >
                  <View style={styles.territoryHeader}>
                    <Text style={styles.territoryName}>{territory.name}</Text>
                    {territory.defensiveBonus && <Text style={styles.bonusTag}>🛡️ Defense</Text>}
                  </View>

                  <View style={[styles.ownerBadge, { backgroundColor: ownerBgColor }]}>
                    <Text style={styles.ownerBadgeText}>{territory.owner}</Text>
                  </View>

                  <View style={styles.troopRow}>
                    <Text style={styles.troopCount}>⚔️ {territory.troops} Troops</Text>
                  </View>

                  <Text style={styles.adjacencyText}>
                    Routes: {territory.adjacentTerritories.length} connected
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Battle Log Panel */}
          <View style={styles.logPanel}>
            <Text style={styles.logPanelTitle}>📜 STRATEGIC BATTLE LOG</Text>
            <ScrollView style={styles.logScrollView} nestedScrollEnabled>
              {game.battleLog.map((log, index) => (
                <View key={log.id || index} style={styles.logItem}>
                  <Text style={styles.logTimestamp}>[{log.timestamp}]</Text>
                  <Text
                    style={[
                      styles.logMessage,
                      log.type === 'conquest' && styles.logConquest,
                      log.type === 'warning' && styles.logWarning,
                      log.type === 'dice' && styles.logDice,
                    ]}
                  >
                    {log.message}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.skyBlue,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.skyBlue,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.charcoal,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.charcoal,
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
  },
  headerTitle: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: COLORS.mossGreen,
    borderRadius: 6,
  },
  backButtonText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 13,
  },
  resetButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: COLORS.oliveGreen,
    borderRadius: 6,
  },
  resetButtonText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 13,
  },
  scrollContent: {
    padding: 15,
    alignItems: 'center',
  },
  mainWrapper: {
    width: '100%',
  },
  mainWrapperDesktop: {
    maxWidth: 900,
  },
  statusCard: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  statusStat: {
    fontSize: 14,
    color: COLORS.charcoal,
  },
  boldText: {
    fontWeight: 'bold',
    color: COLORS.mossGreen,
  },
  commandPanel: {
    marginBottom: 15,
    gap: 10,
  },
  diceButton: {
    backgroundColor: COLORS.yellowGreen,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    elevation: 2,
  },
  disabledButton: {
    opacity: 0.6,
  },
  diceButtonText: {
    color: COLORS.charcoal,
    fontWeight: 'bold',
    fontSize: 15,
    letterSpacing: 0.5,
  },
  attackButton: {
    backgroundColor: '#C0392B',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    elevation: 3,
  },
  attackButtonText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  combatDiceBadge: {
    backgroundColor: COLORS.white,
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  combatDiceText: {
    fontSize: 13,
    color: COLORS.charcoal,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.mossGreen,
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  territoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  territoryCard: {
    width: '48%',
    backgroundColor: COLORS.white,
    borderRadius: 10,
    padding: 12,
    borderTopWidth: 5,
    borderTopColor: COLORS.mossGreen,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  attackerCardSelected: {
    borderWidth: 2,
    borderColor: '#F39C12',
    backgroundColor: '#FEF9E7',
  },
  defenderCardSelected: {
    borderWidth: 2,
    borderColor: '#E74C3C',
    backgroundColor: '#FDEDEC',
  },
  territoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  territoryName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.charcoal,
    flex: 1,
  },
  bonusTag: {
    fontSize: 10,
    color: '#D35400',
    fontWeight: 'bold',
  },
  ownerBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginBottom: 8,
  },
  ownerBadgeText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: 'bold',
  },
  troopRow: {
    marginBottom: 6,
  },
  troopCount: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.charcoal,
  },
  adjacencyText: {
    fontSize: 10,
    color: '#7F8C8D',
  },
  logPanel: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    padding: 15,
    maxHeight: 220,
    elevation: 2,
  },
  logPanelTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.charcoal,
    marginBottom: 8,
  },
  logScrollView: {
    maxHeight: 160,
  },
  logItem: {
    flexDirection: 'row',
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  logTimestamp: {
    fontSize: 11,
    color: '#7F8C8D',
    marginRight: 6,
  },
  logMessage: {
    fontSize: 12,
    color: COLORS.charcoal,
    flex: 1,
  },
  logConquest: {
    color: '#27AE60',
    fontWeight: 'bold',
  },
  logWarning: {
    color: '#C0392B',
    fontWeight: 'bold',
  },
  logDice: {
    color: '#2980B9',
    fontWeight: '600',
  },
});
