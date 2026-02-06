// apps/mobile/src/tamagui.d.ts

import type config from './tamagui.config.cjs';

export type AppConfig = typeof config;

declare module 'tamagui' {
  interface TamaguiCustomConfig extends AppConfig {}

  export const XStack: typeof import('@tamagui/stacks').XStack;
  export const YStack: typeof import('@tamagui/stacks').YStack;
  export const ZStack: typeof import('@tamagui/stacks').ZStack;
  export const Button: typeof import('@tamagui/button').Button;
  export const Text: typeof import('@tamagui/text').Text;
  export const Input: typeof import('@tamagui/input').Input;
  export const Spinner: typeof import('@tamagui/spinner').Spinner;
  export const ScrollView: typeof import('@tamagui/scroll-view').ScrollView;
  export const Switch: typeof import('@tamagui/switch').Switch;
}
