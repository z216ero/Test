const tokens = {
  color: {
    background: '#FFFFFF',
    text: '#0F172A',
    muted: '#64748B',
    primary: '#2563EB',
    primaryText: '#FFFFFF',
    border: '#E2E8F0',
  },
  space: {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    7: 32,
    8: 40,
  },
  size: {
    true: 16,
    1: 12,
    2: 14,
    3: 16,
    4: 18,
    5: 20,
    6: 24,
    7: 28,
    8: 32,
  },
  radius: {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
  },
};

export const config = {
  defaultFont: 'body',
  tokens,
  themes: {
    light: {
      background: tokens.color.background,
      color: tokens.color.text,
      borderColor: tokens.color.border,
    },
    dark: {
      background: '#0B1220',
      color: '#E2E8F0',
      borderColor: '#1E293B',
    },
  },
  fonts: {
    body: {
      family: 'System',
      size: {
        true: 16,
        1: 12,
        2: 14,
        3: 16,
        4: 18,
        5: 20,
        6: 24,
        7: 28,
        8: 32,
      },
      weight: {
        4: '400',
        7: '700',
      },
    },
  },
};

export type AppConfig = typeof config;

declare module 'tamagui' {
  interface TamaguiCustomConfig extends AppConfig {}
}
