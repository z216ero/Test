import { Button, Text, XStack, YStack } from 'tamagui';
import { secondaryButtonProps } from '../formDefaults';
import type { ToastType } from './ToastProvider';

type BannerProps = {
  type: ToastType;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
};

const bannerBorderColor: Record<ToastType, string> = {
  success: '$accent',
  error: '$primary',
  info: '$border',
};

export function Banner({
  type,
  title,
  message,
  actionLabel,
  onAction,
}: BannerProps) {
  return (
    <XStack
      padding="$4"
      gap="$3"
      backgroundColor="$surfaceMuted"
      borderRadius="$4"
      borderWidth={1}
      borderColor={bannerBorderColor[type]}
      alignItems="center"
    >
      <YStack flex={1} gap="$1">
        <Text fontSize="$4" fontWeight="700" color="$text">
          {title}
        </Text>
        {message ? (
          <Text fontSize="$3" color="$muted">
            {message}
          </Text>
        ) : null}
      </YStack>
      {actionLabel && onAction ? (
        <Button
          size="$3"
          backgroundColor="$background"
          borderWidth={1}
          borderColor="$border"
          onPress={onAction}
          {...secondaryButtonProps}
        >
          {actionLabel}
        </Button>
      ) : null}
    </XStack>
  );
}
