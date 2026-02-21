import { Linking } from 'react-native';
import { Button, Text, XStack, YStack } from 'tamagui';
import { t } from '@i18n';
import { AppIcon } from '@ui/AppIcon';

export function NotificationSystemSection() {
  return (
    <YStack gap="$3">
      <Text fontSize="$5" fontWeight="700" color="$text">
        {t('notifications.system.title')}
      </Text>
      <YStack
        backgroundColor="$background"
        borderRadius="$5"
        borderWidth={1}
        borderColor="$border"
        padding="$4"
        gap="$3"
      >
        <XStack alignItems="center" gap="$3">
          <AppIcon name="settings" size={18} color="$muted" />
          <Text fontSize="$3" color="$text" flex={1}>
            {t('notifications.system.permissions')}
          </Text>
          <AppIcon name="chevronRight" size={18} color="$muted" />
        </XStack>
        <Button
          backgroundColor="$background"
          borderRadius="$4"
          borderWidth={1}
          borderColor="$border"
          paddingHorizontal="$3"
          paddingVertical="$2"
          onPress={() => Linking.openSettings()}
          height="$9"
        >
          <Text fontSize="$3" color="$text">
            {t('notifications.system.openSettings')}
          </Text>
        </Button>
      </YStack>
    </YStack>
  );
}

