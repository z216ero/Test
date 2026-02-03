import type { ComponentProps } from 'react';
import { ScrollView } from '@tamagui/scroll-view';
import { useTabBarPadding } from './useTabBarPadding';

type TabScrollViewProps = ComponentProps<typeof ScrollView> & {
  baseSpaceToken?: NonNullable<Parameters<typeof useTabBarPadding>[0]>['baseSpaceToken'];
  extraBottomToken?: NonNullable<Parameters<typeof useTabBarPadding>[0]>['extraBottomToken'];
  extraBottom?: number;
};

export function TabScrollView({
  contentContainerStyle,
  baseSpaceToken,
  extraBottomToken,
  extraBottom,
  ...props
}: TabScrollViewProps) {
  const { contentBottomPadding } = useTabBarPadding({
    baseSpaceToken,
    extraBottomToken,
    extraBottom,
  });

  const normalizedStyle = Array.isArray(contentContainerStyle)
    ? contentContainerStyle.reduce<Record<string, unknown>>((acc, entry) => {
      if (entry && typeof entry === 'object') {
        Object.assign(acc, entry);
      }
      return acc;
    }, {})
    : contentContainerStyle;
  const mergedContentStyle =
    normalizedStyle === 'unset'
      ? { paddingBottom: contentBottomPadding }
      : { ...(normalizedStyle ?? {}), paddingBottom: contentBottomPadding };

  return (
    <ScrollView
      {...props}
      contentContainerStyle={mergedContentStyle}
    />
  );
}
