// apps/mobile/src/tamagui.d.ts

import type config from './tamagui.config.cjs'

export type AppConfig = typeof config

declare module 'tamagui' {
  interface TamaguiCustomConfig extends AppConfig {}
}
