import { Spinner, Text, XStack, YStack } from 'tamagui';
import { t } from '@i18n';

type LoadingStateProps = {
  label?: string;
};

export function LoadingState({
  label = t('common.loading'),
}: LoadingStateProps) {
  return (
    <YStack flex={1} alignItems="center" justifyContent="center" padding="$6">
      <XStack gap="$3" alignItems="center">
        <Spinner size="small" color="$accent" />
        <Text fontSize="$4" color="$muted">
          {label}
        </Text>
      </XStack>
    </YStack>
  );
}

