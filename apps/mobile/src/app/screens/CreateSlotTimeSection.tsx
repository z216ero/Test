import type { UseQueryResult } from '@tanstack/react-query';
import { Text, XStack, YStack, Button } from 'tamagui';
import type { SlotDto } from '@generated/api';
import { t } from '@i18n';
import { AppIcon } from '@ui/AppIcon';
import { Banner } from '@ui/feedback/Banner';
import { SLOT_DURATION_MINUTES } from '@utils/slotTimeGrid';

type CreateSlotTimeSectionProps = {
  selectedRangeLabel: string | null;
  slotsQuery: UseQueryResult<SlotDto[], unknown>;
  unavailableMultiMessage: string | null;
  apiError: string | null;
  grid: Date[];
  selectedStart: Date | null;
  selectedRangeEnd: Date | null;
  resolvedDisabledTimes: Set<number>;
  onTilePress: (time: Date, isDisabled: boolean) => void;
  formatTimeLabel: (value: Date) => string;
};

export function CreateSlotTimeSection({
  selectedRangeLabel,
  slotsQuery,
  unavailableMultiMessage,
  apiError,
  grid,
  selectedStart,
  selectedRangeEnd,
  resolvedDisabledTimes,
  onTilePress,
  formatTimeLabel,
}: CreateSlotTimeSectionProps) {
  return (
    <YStack gap="$3">
      <Text fontSize="$5" fontWeight="700" color="$text">
        {t('createSlot.timeSection')}
      </Text>
      <Text fontSize="$3" color="$muted">
        {t('createSlot.durationHint', { minutes: SLOT_DURATION_MINUTES })}
      </Text>
      {selectedRangeLabel ? (
        <YStack
          padding="$3"
          borderRadius="$4"
          backgroundColor="$surfaceMuted"
          borderWidth={1}
          borderColor="$border"
        >
          <Text fontSize="$3" color="$text">
            {selectedRangeLabel}
          </Text>
        </YStack>
      ) : null}
      {slotsQuery.isLoading ? (
        <Text fontSize="$3" color="$muted">
          {t('common.loading')}
        </Text>
      ) : null}
      {slotsQuery.error ? (
        <Banner
          type="error"
          title={t('createSlot.loadError')}
          actionLabel={t('common.retry')}
          onAction={() => slotsQuery.refetch()}
        />
      ) : null}
      {unavailableMultiMessage ? (
        <Banner type="info" title={unavailableMultiMessage} />
      ) : null}
      {apiError ? <Banner type="error" title={apiError} /> : null}
      <XStack flexWrap="wrap" gap="$2">
        {grid.map((time) => {
          const timeKey = time.getTime();
          const isDisabled = resolvedDisabledTimes.has(timeKey);
          const isSelectedStart =
            selectedStart && selectedStart.getTime() === timeKey;
          const isInSelectedRange =
            selectedStart
            && selectedRangeEnd
            && time.getTime() >= selectedStart.getTime()
            && time.getTime() < selectedRangeEnd.getTime();

          const backgroundColor = isSelectedStart
            ? '$accent'
            : isInSelectedRange || isDisabled
              ? '$surfaceMuted'
              : '$background';
          const borderColor = isSelectedStart || isInSelectedRange
            ? '$accent'
            : '$border';
          const textColor = isSelectedStart
            ? '$accentText'
            : isDisabled
              ? '$muted'
              : '$text';

          return (
            <Button
              key={timeKey}
              width="23%"
              minHeight="$10"
              paddingHorizontal="$2"
              paddingVertical="$3"
              backgroundColor={backgroundColor}
              borderRadius="$4"
              borderWidth={1}
              borderColor={borderColor}
              borderStyle={isDisabled ? 'dashed' : 'solid'}
              opacity={isDisabled ? 0.6 : 1}
              onPress={() => onTilePress(time, isDisabled)}
              disabled={isDisabled}
            >
              <XStack alignItems="center" justifyContent="center" gap="$2">
                <Text
                  fontSize="$3"
                  color={textColor}
                  textDecorationLine={isDisabled ? 'line-through' : 'none'}
                >
                  {formatTimeLabel(time)}
                </Text>
                {isDisabled ? (
                  <AppIcon name="close" size={12} color="$muted" />
                ) : null}
              </XStack>
            </Button>
          );
        })}
      </XStack>
    </YStack>
  );
}


