import type { ComponentType, ReactElement } from 'react';
import type { LucideProps } from 'lucide-react-native';
import { iconsMap } from './icons';
import type { AppIconName } from './icons';
import config from '../../tamagui.config.cjs';

type AppIconProps = {
  name: AppIconName;
  size?: number | string;
  color?: string;
  strokeWidth?: number;
};

export function AppIcon({
  name,
  size = 24,
  color,
  strokeWidth = 1.75,
}: AppIconProps): ReactElement {
  const IconComponent = iconsMap[name] as ComponentType<LucideProps>;
  type TokenValue<T> = { val?: T } | T;
  const isTokenValue = <T,>(value: TokenValue<T>): value is { val?: T } =>
    typeof value === 'object' && value !== null && 'val' in value;
  const resolveToken = <T,>(value: TokenValue<T> | undefined): T | undefined =>
    value && isTokenValue(value) ? value.val : value;

  const colorTokens = config.tokens.color as Record<string, TokenValue<string> | undefined>;
  const sizeTokens = config.tokens.size as Record<string, TokenValue<number> | undefined>;

  const resolvedColor = (() => {
    const fallback = resolveToken(colorTokens.muted) ?? '#64748B';
    if (!color) {
      return fallback;
    }
    if (color.startsWith('$')) {
      const tokenName = color.slice(1);
      const tokenEntry = colorTokens[tokenName];
      const tokenValue = resolveToken(tokenEntry);
      return typeof tokenValue === 'string' ? tokenValue : fallback;
    }
    return color;
  })();

  const resolvedSize = (() => {
    if (typeof size === 'number') {
      return size;
    }
    if (typeof size === 'string' && size.startsWith('$')) {
      const tokenName = size.slice(1);
      const tokenEntry = sizeTokens[tokenName];
      const tokenValue = resolveToken(tokenEntry);
      return typeof tokenValue === 'number' ? tokenValue : 24;
    }
    return Number.isFinite(Number(size)) ? Number(size) : 24;
  })();

  return (
    <IconComponent
      size={resolvedSize}
      color={resolvedColor}
      strokeWidth={strokeWidth}
    />
  );
}
