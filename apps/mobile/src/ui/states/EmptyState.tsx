import { Button, Text, YStack } from 'tamagui';
import { secondaryButtonProps } from '../formDefaults';

type EmptyStateProps = {
  title: string;
  description?: string;
  ctaLabel?: string;
  onCtaPress?: () => void;
};

export function EmptyState({
  title,
  description,
  ctaLabel,
  onCtaPress,
}: EmptyStateProps) {
  return (
    <YStack
      flex={1}
      alignItems="center"
      justifyContent="center"
      padding="$6"
      gap="$3"
    >
      <Text fontSize="$5" fontWeight="600" color="$text" textAlign="center">
        {title}
      </Text>
      {description ? (
        <Text fontSize="$3" color="$muted" textAlign="center">
          {description}
        </Text>
      ) : null}
      {ctaLabel && onCtaPress ? (
        <Button
          size="$3"
          backgroundColor="$accent"
          color="$accentText"
          onPress={onCtaPress}
          {...secondaryButtonProps}
        >
          {ctaLabel}
        </Button>
      ) : null}
    </YStack>
  );
}
