import { Button, Text, XStack, YStack } from 'tamagui';
import { t } from '@i18n';
import { AppIcon } from '@ui/AppIcon';
import type { AppIconName } from '@ui/icons';

export type ProfileSettingsItem = {
  id: string;
  label: string;
  icon: AppIconName;
  onPress?: () => void;
  disabled?: boolean;
};

type ProfileSettingsListProps = {
  items: ProfileSettingsItem[];
};

export function ProfileSettingsList({ items }: ProfileSettingsListProps) {
  return (
    <YStack gap="$3">
      {items.map((item) => (
        <Button
          key={item.id}
          backgroundColor="$background"
          borderRadius="$5"
          borderWidth={1}
          borderColor="$border"
          padding="$4"
          minHeight="$11"
          paddingVertical="$3"
          justifyContent="flex-start"
          onPress={item.onPress}
          disabled={item.disabled}
          opacity={item.disabled ? 0.5 : 1}
        >
          <XStack alignItems="center" gap="$3" flex={1}>
            <AppIcon name={item.icon} size={20} color="$muted" />
            <Text fontSize="$3" color="$text" flex={1}>
              {item.label}
            </Text>
            <Text fontSize="$3" color="$muted">
              {t('common.arrow')}
            </Text>
          </XStack>
        </Button>
      ))}
    </YStack>
  );
}
