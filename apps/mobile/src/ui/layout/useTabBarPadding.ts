import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import config from '../../../tamagui.config.cjs';

type SpaceTokenKey = keyof typeof config.tokens.space;

type TabBarPaddingOptions = {
  baseSpaceToken?: SpaceTokenKey;
  extraBottomToken?: SpaceTokenKey;
  extraBottom?: number;
};

type TokenValue<T> = { val?: T } | T;
const isTokenValue = <T,>(value: TokenValue<T>): value is { val?: T } =>
  typeof value === 'object' && value !== null && 'val' in value;
const resolveTokenValue = <T,>(value: TokenValue<T> | undefined): T | undefined =>
  value && isTokenValue(value) ? value.val : value;

export const useTabBarPadding = (options: TabBarPaddingOptions = {}) => {
  const tabBarHeight = useBottomTabBarHeight();
  const baseSpaceKey = (options.baseSpaceToken ?? 6) as SpaceTokenKey;
  const baseSpace = resolveTokenValue<number>(config.tokens.space[baseSpaceKey]) ?? 0;
  const extraTokenKey = options.extraBottomToken;
  const extraFromToken = extraTokenKey
    ? resolveTokenValue<number>(config.tokens.space[extraTokenKey]) ?? 0
    : 0;
  const extraBottom = options.extraBottom ?? extraFromToken;
  const contentBottomPadding = tabBarHeight + baseSpace + extraBottom;

  return {
    tabBarHeight,
    baseSpace,
    contentBottomPadding,
  };
};
