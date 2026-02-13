import { Text, YStack } from 'tamagui';
import { t } from '@i18n';

type PersonalInfoHeaderProps = {
  isLoading: boolean;
  error: string | null;
};

export function PersonalInfoHeader({ isLoading, error }: PersonalInfoHeaderProps) {
  return (
    <YStack gap="$2">
      <Text fontSize="$7" fontWeight="700" color="$text">
        {t('profile.personal.title')}
      </Text>
      {isLoading ? (
        <Text fontSize="$3" color="$muted">
          {t('common.loading')}
        </Text>
      ) : null}
      {error ? (
        <Text fontSize="$3" color="$danger">
          {error}
        </Text>
      ) : null}
    </YStack>
  );
}
