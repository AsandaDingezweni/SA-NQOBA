// One colour, one meaning. Neutrals carry the screen; everything else is a signal.
//   Lime: you, and what you can do next.
//   Gold: dice and reward.
//   Sky: information and commentary.
//   Red: enemy target, loss, destructive action.
//   Player colours: ownership, and nothing else.
// `npm run check:colors` enforces contrast, player separation and that colours live only in this file.
export const COLORS = {
  lime: '#B7C361',
  sky: '#A5C6D6',
  gold: '#E2B93B',

  deep: '#141612',
  surface: '#1C1E1B',
  panel: '#252820',
  raised: '#2F3329',
  hover: '#3A3F32',

  line: 'rgba(183,195,97,0.18)',
  lineStrong: 'rgba(183,195,97,0.32)',

  text: '#F0F1E6',
  textMuted: '#BABFAA',
  textFaint: '#8B9080',
  onColor: '#141612',

  win: '#8FE0B0',
  danger: '#E95D45',
  dangerText: '#F2907C',

  scrim: 'rgba(0,0,0,0.6)',
  shadow: '#000000',
} as const;

export function mix(base: string, tint: string, amount: number) {
  const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const blended = [0, 1, 2].map((i) => Math.round(channel(base, i) * (1 - amount) + channel(tint, i) * amount));
  return `#${blended.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

export type PlayerTone = { fill: string; wash: string; washHover: string };

const toneOf = (fill: string): PlayerTone => ({
  fill,
  wash: mix(COLORS.raised, fill, 0.10),
  washHover: mix(COLORS.raised, fill, 0.14),
});

// Keyed by the colour the backend stores on each player, so saved games get the same look as new ones.
export const PLAYER_TONES: Record<string, PlayerTone> = {
  '#424D11': toneOf('#B7C361'),
  '#C0392B': toneOf('#EA7D2E'),
  '#2471A3': toneOf('#6EC3EB'),
  '#8E44AD': toneOf('#AF86EC'),
  '#D35400': toneOf('#F8D09D'),
  '#138D75': toneOf('#A1E7E2'),
  '#B7950B': toneOf('#B8A98F'),
  '#5D6D7E': toneOf('#899AB1'),
  '#C2185B': toneOf('#B66F75'),
  '#1A237E': toneOf('#6C7CBC'),
};

const NEUTRAL_TONE: PlayerTone = { fill: COLORS.textMuted, wash: COLORS.raised, washHover: COLORS.hover };

export const playerTone = (color?: string) => (color && PLAYER_TONES[color]) || NEUTRAL_TONE;

export const RADIUS = { sm: 6, md: 10, lg: 16 } as const;

export const PROFILE_LABELS: Record<string, { label: string; icon: string }> = {
  aggressive: { label: 'Aggressive', icon: '🔥' },
  balanced: { label: 'Balanced', icon: '⚖️' },
  defensive: { label: 'Defensive', icon: '🛡️' },
  mixed: { label: 'Mixed', icon: '🎲' },
};

export const BREAKPOINTS = { tablet: 700, desktop: 1100 } as const;
