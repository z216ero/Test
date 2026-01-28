import { Text, YStack } from 'tamagui';
import { t } from '../../i18n';

export function BookingsScreen() {
  return (
    <YStack flex={1} backgroundColor="$backgroundSoft">
      <YStack flex={1} padding="$6" gap="$4">
        <YStack gap="$2">
          <Text fontSize="$8" fontWeight="700" color="$text">
            {t('bookings.title')}
          </Text>
          <Text fontSize="$4" color="$muted">
            {t('bookings.subtitle')}
          </Text>
        </YStack>
        <YStack
          padding="$5"
          backgroundColor="$background"
          borderRadius="$5"
          borderWidth={1}
          borderColor="$border"
        >
          <Text fontSize="$3" color="$muted">
            {t('bookings.placeholder')}
          </Text>
        </YStack>
      </YStack>
    </YStack>
  );
}
