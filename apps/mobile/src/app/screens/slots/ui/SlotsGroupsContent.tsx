import { YStack } from 'tamagui';
import type { ClientBooking } from '@api/bookingsApi';
import type { AvailableSlotTrainerDto, SlotDto } from '@generated/api';
import { t } from '@i18n';
import { EmptyState } from '@ui/states/EmptyState';
import { type SlotGroup, TrainerSlotGroupCard } from './TrainerSlotGroupCard';

type SlotsGroupsContentProps = {
  filtersReady: boolean;
  lookupsReady: boolean;
  isLoading: boolean;
  groups: SlotGroup[];
  hasActiveFilters: boolean;
  onResetFilters: () => void;
  onOpenDatePicker: () => void;
  bookings: ClientBooking[];
  canCheckConflicts: boolean;
  nowTs: number;
  pendingActionBookingId: string | null;
  onConfirmPending: (bookingId: string) => void;
  onDeclinePending: (bookingId: string) => void;
  onOpenSlot: (slot: SlotDto, trainer: AvailableSlotTrainerDto) => void;
};

const SlotsSkeleton = () => (
  <YStack gap="$4">
    {Array.from({ length: 2 }).map((_, index) => (
      <YStack
        key={`skeleton-${index}`}
        gap="$3"
        padding="$4"
        backgroundColor="$background"
        borderRadius="$5"
        borderWidth={1}
        borderColor="$border"
      >
        <YStack gap="$3">
          <YStack height={16} width="60%" backgroundColor="$surfaceMuted" borderRadius="$3" />
          <YStack height={12} width="40%" backgroundColor="$surfaceMuted" borderRadius="$3" />
        </YStack>
        <YStack gap="$2">
          <YStack height={14} width="80%" backgroundColor="$surfaceMuted" borderRadius="$3" />
          <YStack height={14} width="70%" backgroundColor="$surfaceMuted" borderRadius="$3" />
        </YStack>
      </YStack>
    ))}
  </YStack>
);

export function SlotsGroupsContent({
  filtersReady,
  lookupsReady,
  isLoading,
  groups,
  hasActiveFilters,
  onResetFilters,
  onOpenDatePicker,
  bookings,
  canCheckConflicts,
  nowTs,
  pendingActionBookingId,
  onConfirmPending,
  onDeclinePending,
  onOpenSlot,
}: SlotsGroupsContentProps) {
  if (!filtersReady || !lookupsReady || isLoading) {
    return <SlotsSkeleton />;
  }

  if (groups.length === 0) {
    if (hasActiveFilters) {
      return (
        <EmptyState
          title={t('slots.empty.filtersTitle')}
          ctaLabel={t('slots.empty.resetFilters')}
          onCtaPress={onResetFilters}
        />
      );
    }

    return (
      <EmptyState
        title={t('slots.empty.dateTitle')}
        ctaLabel={t('slots.empty.changeDate')}
        onCtaPress={onOpenDatePicker}
      />
    );
  }

  return (
    <YStack gap="$4">
      {groups.map((group) => (
        <TrainerSlotGroupCard
          key={group.trainer.id ?? `trainer-${group.trainer.name ?? 'unknown'}`}
          group={group}
          bookings={bookings}
          canCheckConflicts={canCheckConflicts}
          nowTs={nowTs}
          pendingActionBookingId={pendingActionBookingId}
          onConfirmPending={onConfirmPending}
          onDeclinePending={onDeclinePending}
          onOpenSlot={onOpenSlot}
        />
      ))}
    </YStack>
  );
}
