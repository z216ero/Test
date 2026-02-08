import { Button, Text, XStack, YStack } from 'tamagui';
import { t } from '@i18n';
import { AppIcon } from '@ui/AppIcon';

type SlotsHeaderProps = {
  hasActiveFilters: boolean;
  onOpenFilters: () => void;
};

export function SlotsHeader({ hasActiveFilters, onOpenFilters }: SlotsHeaderProps) {
  return (
    <XStack justifyContent="space-between" alignItems="center">
      <YStack gap="$1">
        <Text fontSize="$8" fontWeight="700" color="$text">
          {t('slots.title')}
        </Text>
        <Text fontSize="$3" color="$muted">
          {t('slots.subtitle')}
        </Text>
      </YStack>
      <Button
        backgroundColor="$background"
        borderRadius="$4"
        borderWidth={1}
        borderColor="$border"
        minHeight="$9"
        paddingHorizontal="$3"
        onPress={onOpenFilters}
      >
        <XStack alignItems="center" gap="$2">
          <AppIcon name="settings" size={18} color="$muted" />
          <Text fontSize="$3" color="$text">
            {t('slots.filters.button')}
          </Text>
          {hasActiveFilters ? (
            <YStack
              width={6}
              height={6}
              borderRadius={3}
              backgroundColor="$accent"
            />
          ) : null}
        </XStack>
      </Button>
    </XStack>
  );
}
