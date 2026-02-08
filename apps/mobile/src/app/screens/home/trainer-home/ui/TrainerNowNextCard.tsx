import { Button, Text, XStack, YStack } from 'tamagui';
import type { SlotDto } from '@generated/api';
import { t } from '@i18n';
import { canMarkCompleted, canMarkNoShow } from '@app/components/schedule/slotHelpers';
import { Avatar } from '@ui/components';

type AvatarSource = {
  uri: string;
  headers?: Record<string, string>;
};

type TrainerNowNextCardProps = {
  isLoading: boolean;
  hasError: boolean;
  highlightSlot: SlotDto | null;
  currentSlot: SlotDto | null;
  highlightTimeLabel: string;
  highlightTitleLabel: string;
  highlightDetailLabel: string | null;
  isGroupTraining: boolean;
  highlightAvatarSource: AvatarSource | null;
  nowTs: number;
  showAttendanceActions: boolean;
  onRetry: () => void;
  onMarkCompleted: (slot: SlotDto) => void;
  onMarkNoShow: (slot: SlotDto) => void;
  onGoToSchedule: () => void;
};

export function TrainerNowNextCard({
  isLoading,
  hasError,
  highlightSlot,
  currentSlot,
  highlightTimeLabel,
  highlightTitleLabel,
  highlightDetailLabel,
  isGroupTraining,
  highlightAvatarSource,
  nowTs,
  showAttendanceActions,
  onRetry,
  onMarkCompleted,
  onMarkNoShow,
  onGoToSchedule,
}: TrainerNowNextCardProps) {
  const sectionTitle = t('home.trainer.sectionTitle');

  if (isLoading) {
    return (
      <YStack
        gap="$3"
        padding="$5"
        backgroundColor="$background"
        borderRadius="$6"
        borderWidth={1}
        borderColor="$border"
      >
        <Text fontSize="$4" fontWeight="700" color="$text">
          {sectionTitle}
        </Text>
        <Text fontSize="$3" color="$muted">
          {t('common.loading')}
        </Text>
      </YStack>
    );
  }

  if (hasError) {
    return (
      <YStack
        gap="$3"
        padding="$5"
        backgroundColor="$background"
        borderRadius="$6"
        borderWidth={1}
        borderColor="$border"
      >
        <Text fontSize="$4" fontWeight="700" color="$text">
          {sectionTitle}
        </Text>
        <Text fontSize="$3" color="$muted">
          {t('errors.generic')}
        </Text>
        <Button
          backgroundColor="$accent"
          color="$accentText"
          borderRadius="$4"
          minHeight="$9"
          paddingHorizontal="$4"
          onPress={onRetry}
        >
          {t('common.retry')}
        </Button>
      </YStack>
    );
  }

  if (!highlightSlot) {
    return (
      <YStack
        gap="$3"
        padding="$5"
        backgroundColor="$background"
        borderRadius="$6"
        borderWidth={1}
        borderColor="$border"
      >
        <Text fontSize="$4" fontWeight="700" color="$text">
          {sectionTitle}
        </Text>
        <Text fontSize="$3" color="$muted">
          {t('home.trainer.noTrainings')}
        </Text>
      </YStack>
    );
  }

  const header = currentSlot
    ? t('home.trainer.nowTitle')
    : t('home.trainer.nextTitle');

  return (
    <YStack
      gap="$3"
      padding="$5"
      backgroundColor="$background"
      borderRadius="$6"
      borderWidth={1}
      borderColor="$border"
      minHeight="200"
    >
      <YStack gap="$1">
        <Text fontSize="$4" fontWeight="700" color="$text">
          {header}
        </Text>
        <Text fontSize="$3" color="$muted">
          {highlightTimeLabel}
        </Text>
      </YStack>
      <XStack gap="$3" alignItems="center">
        <Avatar
          name={isGroupTraining ? null : highlightDetailLabel}
          source={highlightAvatarSource}
          size="$10"
          borderRadius="$6"
          textSize="$4"
          fallbackIcon={isGroupTraining ? 'users' : null}
        />
        <YStack gap="$1" flex={1}>
          <Text fontSize="$4" fontWeight="700" color="$text">
            {highlightTitleLabel}
          </Text>
          <Text fontSize="$3" color="$muted">
            {highlightDetailLabel ?? t('common.empty')}
          </Text>
        </YStack>
      </XStack>
      {currentSlot && showAttendanceActions ? (
        <XStack gap="$3" flexWrap="wrap">
          {canMarkCompleted(currentSlot, nowTs) ? (
            <Button
              flex={1}
              minHeight="$9"
              backgroundColor="$accent"
              color="$accentText"
              borderRadius="$5"
              onPress={() => onMarkCompleted(currentSlot)}
            >
              {t('slotDetails.markCompleted')}
            </Button>
          ) : null}
          {canMarkNoShow(currentSlot, nowTs) ? (
            <Button
              flex={1}
              minHeight="$9"
              backgroundColor="$surfaceMuted"
              borderRadius="$5"
              borderWidth={1}
              borderColor="$border"
              onPress={() => onMarkNoShow(currentSlot)}
            >
              {t('slotDetails.markNoShow')}
            </Button>
          ) : null}
        </XStack>
      ) : null}
      {!currentSlot ? (
        <Button
          backgroundColor="$surfaceMuted"
          borderRadius="$5"
          borderWidth={1}
          borderColor="$border"
          minHeight="$9"
          onPress={onGoToSchedule}
        >
          {t('home.trainer.goToSchedule')}
        </Button>
      ) : null}
    </YStack>
  );
}
