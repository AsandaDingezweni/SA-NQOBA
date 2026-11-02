export const COLORS = {
  skyBlue: '#A5C6D6',
  yellowGreen: '#B7C361',
  oliveGreen: '#848833',
  mossGreen: '#424D11',
  charcoal: '#1A1C19',
  white: '#FFFFFF',

  ink: '#1A1C19',
  muted: '#5E6457',
  paper: '#F4F6EE',
  line: 'rgba(26,28,25,0.12)',

  board: '#1A1C19',
  boardPanel: '#24271F',
  boardRaised: '#2E3227',
  boardLine: 'rgba(183,195,97,0.18)',
  boardText: '#EEF0E6',
  boardMuted: '#A3A893',

  danger: '#C0392B',
  gold: '#E2B93B',
  win: '#7DBB4A',
} as const;

export const RADIUS = { sm: 6, md: 10, lg: 16 } as const;

export const PROFILE_LABELS: Record<string, { label: string; icon: string }> = {
  aggressive: { label: 'Aggressive', icon: '🔥' },
  balanced: { label: 'Balanced', icon: '⚖️' },
  defensive: { label: 'Defensive', icon: '🛡️' },
  mixed: { label: 'Mixed', icon: '🎲' },
};

export const BREAKPOINTS = { tablet: 700, desktop: 1100 } as const;
