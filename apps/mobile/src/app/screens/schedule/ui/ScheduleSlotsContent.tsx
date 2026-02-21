import { YStack } from 'tamagui';
import type { SlotDto } from '@generated/api';
import { t } from '@i18n';
import { EmptyState } from '@ui/states/EmptyState';
import { ErrorState } from '@ui/states/ErrorState';
import { SlotCard } from '@app/components/schedule/SlotCard';
import { getUiSlotStatus, isClientDeclinedSlot } from '@app/components/schedule/slotHelpers';
import { ScheduleCompletedTodaySection } from './ScheduleCompletedTodaySection';
import { ScheduleSkeleton } from './ScheduleSkeleton';

type ScheduleSlotsContentProps = {
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  isPastDay: boolean;
  sortedSlots: SlotDto[];
  activeSlots: SlotDto[];
  nowTs: number;
  canCreateSlot: boolean;
  isSelectedToday: boolean;
  completedTodaySlots: SlotDto[];
  completedExpanded: boolean;
  onToggleCompleted: () => void;
  onCreateSlot: () => void;
  onOpenSlot: (slot: SlotDto) => void;
  getHighlightForSlot: (slot: SlotDto) => { color: 'success' | 'destructive'; chipText: string } | null;
  isDeclinedReleased: (slotId?: string | null) => boolean;
};

export function ScheduleSlotsContent({
  isLoading,
  error,
  onRetry,
  isPastDay,
  sortedSlots,
  activeSlots,
  nowTs,
  canCreateSlot,
  isSelectedToday,
  completedTodaySlots,
  completedExpanded,
  onToggleCompleted,
  onCreateSlot,
  onOpenSlot,
  getHighlightForSlot,
  isDeclinedReleased,
}: ScheduleSlotsContentProps) {
  if (isLoading) {
    return <ScheduleSkeleton />;
  }

  if (error) {
    return <ErrorState error={error} onRetry={onRetry} />;
  }

  const visibleSlots = isPastDay
    ? sortedSlots.filter((slot) => getUiSlotStatus(slot, nowTs) !== 'available')
    : activeSlots;
  const showCompletedTodaySection = isSelectedToday && completedTodaySlots.length > 0;

  if (visibleSlots.length === 0) {
    if (showCompletedTodaySection) {
      return (
        <YStack gap="$4">
          <ScheduleCompletedTodaySection
            open={completedExpanded}
            count={completedTodaySlots.length}
            slots={completedTodaySlots}
            nowTs={nowTs}
            onToggle={onToggleCompleted}
            getHighlight={getHighlightForSlot}
          />
        </YStack>
      );
    }

    return (
      <EmptyState
        title={t('schedule.emptyDay')}
        ctaLabel={canCreateSlot ? t('schedule.createCta') : undefined}
        onCtaPress={canCreateSlot ? onCreateSlot : undefined}
      />
    );
  }

  return (
    <YStack gap="$4">
      {visibleSlots.map((slot) => (
        <SlotCard
          key={slot.id ?? `${slot.startsAtUtc ?? 'slot'}`}
          slot={slot}
          nowTs={nowTs}
          onPress={slot.id ? () => onOpenSlot(slot) : undefined}
          highlight={getHighlightForSlot(slot)}
          statusOverride={
            slot.id
              && isClientDeclinedSlot(slot, nowTs)
              && !isDeclinedReleased(slot.id)
              ? 'client_declined'
              : undefined
          }
        />
      ))}
      {showCompletedTodaySection ? (
        <ScheduleCompletedTodaySection
          open={completedExpanded}
          count={completedTodaySlots.length}
          slots={completedTodaySlots}
          nowTs={nowTs}
          onToggle={onToggleCompleted}
          getHighlight={getHighlightForSlot}
        />
      ) : null}
    </YStack>
  );
}
