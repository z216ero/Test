import { Button, Text, YStack } from 'tamagui';
import { presentApiError, type PresentedError } from '../../api/ApiErrorPresenter';
import { t } from '../../i18n';
import { secondaryButtonProps } from '../formDefaults';

type ErrorStateProps = {
  error?: unknown;
  presentedError?: PresentedError;
  title?: string;
  message?: string;
  retryLabel?: string;
  onRetry?: () => void;
};

export function ErrorState({
  error,
  presentedError,
  title,
  message,
  retryLabel = t('common.retry'),
  onRetry,
}: ErrorStateProps) {
  const resolved =
    error ? presentApiError(error) : presentedError ?? presentApiError(null);

  return (
    <YStack
      flex={1}
      alignItems="center"
      justifyContent="center"
      padding="$6"
      gap="$3"
    >
      <Text fontSize="$5" fontWeight="600" color="$text" textAlign="center">
        {title ?? resolved.title}
      </Text>
      <Text fontSize="$3" color="$muted" textAlign="center">
        {message ?? resolved.message}
      </Text>
      {onRetry ? (
        <Button
          size="$3"
          backgroundColor="$accent"
          color="$accentText"
          onPress={onRetry}
          {...secondaryButtonProps}
        >
          {retryLabel}
        </Button>
      ) : null}
    </YStack>
  );
}
