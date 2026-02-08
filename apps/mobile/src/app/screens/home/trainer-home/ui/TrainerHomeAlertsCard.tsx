import { Text, XStack, YStack } from 'tamagui';
import { t } from '@i18n';
import { AppIcon } from '@ui/AppIcon';

type TrainerHomeAlertsCardProps = {
  alerts: string[];
};

export function TrainerHomeAlertsCard({ alerts }: TrainerHomeAlertsCardProps) {
  if (alerts.length === 0) {
    return null;
  }

  return (
    <YStack
      gap="$3"
      padding="$4"
      backgroundColor="$background"
      borderRadius="$6"
      borderWidth={1}
      borderColor="$border"
    >
      <XStack alignItems="center" gap="$2">
        <AppIcon name="alertCircle" size={18} color="$muted" />
        <Text fontSize="$4" fontWeight="600" color="$text">
          {t('home.trainer.alertsTitle')}
        </Text>
      </XStack>
      {alerts.map((item) => (
        <XStack key={item} gap="$2" alignItems="flex-start">
          <YStack marginTop="$1">
            <AppIcon name="info" size={16} color="$muted" />
          </YStack>
          <Text fontSize="$3" color="$text" flex={1}>
            {item}
          </Text>
        </XStack>
      ))}
    </YStack>
  );
}
