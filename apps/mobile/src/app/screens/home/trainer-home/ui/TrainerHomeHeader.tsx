import { Text, XStack } from 'tamagui';
import { t } from '@i18n';
import { Avatar } from '@ui/components';

type AvatarSource = {
  uri: string;
  headers?: Record<string, string>;
};

type TrainerHomeHeaderProps = {
  profileAvatarSource: AvatarSource | null;
};

export function TrainerHomeHeader({ profileAvatarSource }: TrainerHomeHeaderProps) {
  return (
    <XStack alignItems="center" justifyContent="space-between">
      <Text fontSize="$8" fontWeight="700" color="$text">
        {t('home.trainer.title')}
      </Text>
      <Avatar
        source={profileAvatarSource}
        size="$10"
        borderRadius="$6"
        backgroundColor="$background"
        fallbackIcon="user"
      />
    </XStack>
  );
}
