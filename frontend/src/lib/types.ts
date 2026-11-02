export type Phase = 'reinforce' | 'main' | 'attacking' | 'occupy' | 'finished';
export type GameStatus = 'active' | 'won' | 'lost';
export type NpcProfile = 'aggressive' | 'balanced' | 'defensive';

export interface User {
  id: string;
  username: string;
  role: 'player' | 'admin';
}

export interface Country {
  code: string;
  iso2: string;
  name: string;
  region: string;
  population: number;
  soldiers: number;
}

export interface CountryState {
  code: string;
  iso2: string;
  name: string;
  region: string;
  population: number;
  value: number;
  owner: string;
  soldiers: number;
}

export interface PlayerStats {
  attacks: number;
  conquests: number;
  rolls: number;
  soldiersLost: number;
  soldiersKilled: number;
  reinforcements: number;
}

export interface Player {
  pid: string;
  name: string;
  kind: 'human' | 'npc';
  profile: NpcProfile | null;
  color: string;
  startCountry: string;
  eliminated: boolean;
  stats: PlayerStats;
}

export type EventType =
  | 'game_start' | 'turn_start' | 'reinforce' | 'transfer' | 'attack_start' | 'roll' | 'attack_stop'
  | 'attack_failed' | 'conquest' | 'occupy' | 'elimination' | 'turn_end' | 'victory' | 'defeat';

export interface DicePair {
  attacker: number;
  defender: number;
  winner: 'attacker' | 'defender' | 'tie';
}

export interface GameEvent {
  seq: number;
  round: number;
  actor: string | null;
  type: EventType;
  message: string;
  reason: string | null;
  commentary: string | null;
  commentarySource: 'ai' | 'fallback' | null;
  dice: { attacker: number[]; defender: number[] } | null;
  patch: { code: string; owner: string; soldiers: number }[];
  data: Record<string, any> | null;
  at: string;
}

export interface GameView {
  id: string;
  owner: string;
  ownerName: string;
  status: GameStatus;
  phase: Phase;
  round: number;
  currentPid: string;
  turnOrder: string[];
  players: Player[];
  countries: CountryState[];
  pendingReinforcements: number;
  attackUsed: boolean;
  battle: { from: string; to: string; defender: string; rolls: number } | null;
  pendingOccupy: { from: string; to: string; max: number } | null;
  eventSeq: number;
  winner: string | null;
  settings: { npcProfile: 'mixed' | NpcProfile; aiStrategist: boolean };
  humanCountry: string;
  createdAt: string;
  updatedAt: string;
  events: GameEvent[];
}

export interface GameSummary {
  id: string;
  ownerName: string;
  status: GameStatus;
  round: number;
  startCountry: { code: string; name: string; iso2: string };
  countriesHeld: number;
  playersAlive: number;
  currentPlayer?: string;
  updatedAt: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
}

export interface CommandResult {
  game: GameView;
  events: GameEvent[];
}
