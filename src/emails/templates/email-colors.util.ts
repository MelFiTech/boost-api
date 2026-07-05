/** Shared dark-mode email palette — tuned for WCAG contrast on #0a0a0a / #141414. */
export const EMAIL_COLORS = {
  bg: '#0a0a0a',
  bgCard: '#141414',
  textPrimary: '#ffffff',
  /** Near-white — resists Gmail/Apple dark-mode inversion better than pure #fff. */
  textOnDark: '#fffffe',
  textBody: '#d4d4d4',
  textSecondary: '#c4c4c4',
  textMuted: '#a3a3a3',
  textLabel: '#b3b3b3',
  accentLime: '#D9FF02',
  accentOrange: '#f97316',
  accentGreen: '#22c55e',
  accentBlue: '#3b82f6',
  accentAmber: '#FFB020',
  accentRed: '#ef4444',
} as const;
