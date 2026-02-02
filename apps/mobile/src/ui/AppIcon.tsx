import { getTokens } from '@tamagui/core';
import type { ComponentType, ReactElement } from 'react';
import type { LucideProps } from 'lucide-react-native';
import { iconsMap } from './icons';
import type { AppIconName } from './icons';

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
  const tokens = getTokens();
  const colorTokens = tokens.color as Record<string, { val?: string } | string | undefined>;
  const sizeTokens = tokens.size as Record<string, { val?: number } | number | undefined>;

  const resolvedColor = (() => {
    const fallback =
      (typeof colorTokens.muted === 'object' ? colorTokens.muted?.val : colorTokens.muted) ??
      '#64748B';
    if (!color) {
      return fallback;
    }
    if (color.startsWith('$')) {
      const tokenName = color.slice(1);
      const tokenEntry = colorTokens[tokenName];
      const tokenValue = typeof tokenEntry === 'object' ? tokenEntry?.val : tokenEntry;
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
      const tokenValue = typeof tokenEntry === 'object' ? tokenEntry?.val : tokenEntry;
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
