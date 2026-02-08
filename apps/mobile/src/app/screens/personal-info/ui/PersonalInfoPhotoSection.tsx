import { Button, Text, XStack, YStack } from 'tamagui';
import { t } from '@i18n';
import { secondaryButtonProps } from '@ui/formDefaults';
import { Avatar } from '@ui/components';

type AvatarSource = {
  uri: string;
  headers?: Record<string, string>;
};

type PersonalInfoPhotoSectionProps = {
  avatarSource: AvatarSource | null;
  initials: string;
  onPickPhoto: () => void;
  disabled: boolean;
};

export function PersonalInfoPhotoSection({
  avatarSource,
  initials,
  onPickPhoto,
  disabled,
}: PersonalInfoPhotoSectionProps) {
  return (
    <YStack
      gap="$3"
      padding="$4"
      backgroundColor="$background"
      borderRadius="$5"
      borderWidth={1}
      borderColor="$border"
    >
      <Text fontSize="$4" fontWeight="700" color="$text">
        {t('profile.personal.photo')}
      </Text>
      <XStack alignItems="center" gap="$4">
        <Avatar
          fallbackText={initials}
          source={avatarSource}
          size="$11"
          borderRadius="$6"
          textSize="$5"
        />
        <Button
          backgroundColor="$background"
          borderRadius="$4"
          borderWidth={1}
          borderColor="$border"
          onPress={onPickPhoto}
          disabled={disabled}
          paddingHorizontal="$3"
          {...secondaryButtonProps}
        >
          <Text fontSize="$3" color="$text">
            {t('profile.personal.pickPhoto')}
          </Text>
        </Button>
      </XStack>
    </YStack>
  );
}
