import { Button, Text, XStack, YStack } from 'tamagui';
import type { AvailableSlotTrainerDto, SlotDto } from '@generated/api';
import type { ClientBooking } from '@api/bookingsApi';
import { getSlotWorkoutType } from '@api/workoutTypesApi';
import { t } from '@i18n';
import { AppIcon } from '@ui/AppIcon';
import { TrainerAvatar } from '@app/components/bookings/TrainerAvatar';
import { getBookingStatusType } from '@app/components/bookings/bookingUtils';
import { WorkoutTypeChip } from '@app/components/workout/WorkoutTypeChip';
import { formatTimeRangeRu } from '@utils/datetime';
import { formatPrice } from '@utils/price';

export type SlotGroup = {
  trainer: AvailableSlotTrainerDto;
  slots: SlotDto[];
};

type TrainerSlotGroupCardProps = {
  group: SlotGroup;
  bookings: ClientBooking[];
  canCheckConflicts: boolean;
  nowTs: number;
  onOpenSlot: (slot: SlotDto, trainer: AvailableSlotTrainerDto) => void;
  onConfirmPending?: (bookingId: string) => void;
  onDeclinePending?: (bookingId: string) => void;
  pendingActionBookingId?: string | null;
};

const getSlotRange = (slot: SlotDto): { start: number; end: number } | null => {
  if (!slot.startsAtUtc) {
    return null;
  }
  const start = new Date(slot.startsAtUtc).getTime();
  if (Number.isNaN(start)) {
    return null;
  }
  const duration = slot.durationMinutes ?? 0;
  return { start, end: start + duration * 60 * 1000 };
};

const hasTimeConflict = (slot: SlotDto, bookings: ClientBooking[]): boolean => {
  const slotRange = getSlotRange(slot);
  if (!slotRange) {
    return false;
  }
  return bookings.some((booking) => {
    if (slot.id && booking.slot.id && slot.id === booking.slot.id) {
      return false;
    }
    const bookingRange = booking.slot ? getSlotRange(booking.slot) : null;
    if (!bookingRange) {
      return false;
    }
    return slotRange.start < bookingRange.end && bookingRange.start < slotRange.end;
  });
};

const getBookingForSlot = (slot: SlotDto, bookings: ClientBooking[]): ClientBooking | null => {
  if (!slot.id) {
    return null;
  }
  return bookings.find((booking) => booking.slot.id === slot.id) ?? null;
};

const normalizeStatus = (value?: string | null) => value?.toLowerCase().trim();

const isSlotOpen = (slot: SlotDto) => {
  const normalized = normalizeStatus(slot.status);
  return normalized === 'open' || normalized === 'available';
};

const isGroupSlot = (slot: SlotDto) =>
  (slot.slotType ?? '').toLowerCase() === 'group';

const buildLocationLabel = (trainer: AvailableSlotTrainerDto) => {
  const locationParts = [trainer.cityName, trainer.districtName].filter(
    (value): value is string => !!value && value.trim().length > 0
  );
  return locationParts.length > 0 ? locationParts.join(', ') : null;
};

export function TrainerSlotGroupCard({
  group,
  bookings,
  canCheckConflicts,
  nowTs,
  onOpenSlot,
  onConfirmPending,
  onDeclinePending,
  pendingActionBookingId,
}: TrainerSlotGroupCardProps) {
  const trainer = group.trainer;
  const trainerName = trainer.name ?? t('common.empty');
  const ratingLabel = trainer.rating ? trainer.rating.toFixed(1) : null;
  const locationLabel = buildLocationLabel(trainer);

  return (
    <YStack
      gap="$3"
      padding="$4"
      backgroundColor="$background"
      borderRadius="$5"
      borderWidth={1}
      borderColor="$border"
    >
      <XStack alignItems="center" justifyContent="space-between" gap="$3">
        <XStack alignItems="center" gap="$3" flex={1}>
          <TrainerAvatar
            name={trainerName}
            avatarUrl={trainer.avatarUrl}
            size="$10"
            trainerProfile={trainer}
          />
          <YStack gap="$1" flex={1}>
            <XStack alignItems="center" justifyContent="space-between" gap="$2">
              <Text fontSize="$4" fontWeight="700" color="$text" flex={1} numberOfLines={1}>
                {trainerName}
              </Text>
              {ratingLabel ? (
                <XStack alignItems="center" gap="$1">
                  <AppIcon name="star" size={14} color="$accent" />
                  <Text fontSize="$3" color="$muted" fontWeight="600">
                    {ratingLabel}
                  </Text>
                </XStack>
              ) : null}
            </XStack>
            {locationLabel ? (
              <Text fontSize="$3" color="$muted">
                {locationLabel}
              </Text>
            ) : null}
          </YStack>
        </XStack>
      </XStack>

      <YStack gap="$2">
        {group.slots.map((slot) => {
          const times = slot.startsAtUtc ? new Date(slot.startsAtUtc) : null;
          const range = times
            ? {
              start: times,
              end: new Date(
                times.getTime() + (slot.durationMinutes ?? 0) * 60 * 1000
              ),
            }
            : null;
          const timeLabel = range
            ? formatTimeRangeRu(range.start, range.end)
            : t('common.empty');
          const priceLabel = formatPrice(
            slot.trainerPricePerSession ?? trainer.pricePerSession
          );
          const conflict = canCheckConflicts && hasTimeConflict(slot, bookings);
          const startTs = range?.start.getTime() ?? null;
          const isPast = startTs !== null && startTs <= nowTs;
          const open = isSlotOpen(slot);
          const groupSlot = isGroupSlot(slot);
          const clientBooking = getBookingForSlot(slot, bookings);
          const clientBookingStatus = clientBooking
            ? getBookingStatusType(clientBooking.slot, nowTs)
            : null;
          const isPendingConfirmation = clientBookingStatus === 'pending_confirmation';
          const isBookedByCurrentClient =
            clientBookingStatus === 'booked' || clientBookingStatus === 'pending_confirmation';
          const pendingBookingId = isPendingConfirmation
            ? (clientBooking?.slot.bookingId ?? slot.bookingId ?? null)
            : null;
          const workoutType = getSlotWorkoutType(slot);
          const isPendingActionBusy = Boolean(pendingBookingId) && pendingActionBookingId === pendingBookingId;
          const occupiedCount = slot.occupiedCount ?? 0;
          const capacityMax = slot.capacityMax ?? null;
          const isFull = slot.isFull ?? (
            groupSlot
            && capacityMax !== null
            && occupiedCount >= capacityMax
          );
          const isBookable = Boolean(slot.id)
            && open
            && !isPast
            && !conflict
            && !isFull
            && !isBookedByCurrentClient;
          const canOpenDetails = Boolean(slot.id) && (isBookable || isBookedByCurrentClient);
          const statusLabel = isBookedByCurrentClient
            ? isPendingConfirmation
              ? t('slots.status.pendingConfirmation')
              : t('slots.status.bookedByYou')
            : conflict
            ? t('slots.status.conflict')
            : isFull
              ? t('slots.status.full')
              : open && !isPast
                ? t('slots.status.available')
                : t('slots.status.unavailable');
          const statusColor = isBookedByCurrentClient
            ? isPendingConfirmation ? '$primary' : '$accent'
            : conflict
            ? '$danger'
            : isFull
              ? '$danger'
              : open && !isPast
                ? '$accent'
                : '$muted';

          return (
            <Button
              key={slot.id ?? `${slot.startsAtUtc ?? 'slot'}-${timeLabel}`}
              unstyled
              backgroundColor={
                isPendingConfirmation
                  ? '$background'
                  : isBookable
                    ? '$background'
                    : '$surfaceMuted'
              }
              borderRadius="$4"
              borderWidth={1}
              borderColor={
                isPendingConfirmation
                  ? '$primary'
                  : isBookedByCurrentClient
                    ? '$accent'
                    : isBookable
                      ? '$border'
                      : '$surfaceMuted'
              }
              padding="$3"
              alignItems="stretch"
              onPress={() => {
                if (!canOpenDetails || !slot.id) {
                  return;
                }
                onOpenSlot(slot, trainer);
              }}
              disabled={!canOpenDetails}
            >
              <XStack justifyContent="space-between" alignItems="center">
                <Text fontSize="$4" fontWeight="600" color={isBookable ? '$text' : '$muted'}>
                  {timeLabel}
                </Text>
                <XStack alignItems="center" gap="$2">
                  {isBookedByCurrentClient ? (
                    <AppIcon
                      name={isPendingConfirmation ? 'info' : 'check'}
                      size={14}
                      color={isPendingConfirmation ? '$primary' : '$accent'}
                    />
                  ) : null}
                  {groupSlot ? (
                    <>
                      <AppIcon name="users" size={14} color="$muted" />
                      <Text fontSize="$3" color={isBookable ? '$text' : '$muted'}>
                        {capacityMax ? `${occupiedCount}/${capacityMax}` : `${occupiedCount}`}
                      </Text>
                    </>
                  ) : (
                    <AppIcon name="user" size={14} color="$muted" />
                  )}
                  {priceLabel ? (
                    <Text fontSize="$3" color={isBookable ? '$text' : '$muted'}>
                      {priceLabel}
                    </Text>
                  ) : null}
                </XStack>
              </XStack>
              <Text fontSize="$2" color={statusColor} marginTop="$1">
                {statusLabel}
              </Text>
              {workoutType ? (
                <XStack marginTop="$2">
                  <WorkoutTypeChip
                    label={workoutType.name}
                    archived={Boolean(workoutType.isArchived)}
                    compact
                  />
                </XStack>
              ) : null}
              {isPendingConfirmation && pendingBookingId ? (
                <XStack gap="$2" marginTop="$3">
                  <Button
                    flex={1}
                    backgroundColor="$accent"
                    color="$accentText"
                    borderRadius="$3"
                    minHeight="$9"
                    disabled={isPendingActionBusy}
                    onPress={() => onConfirmPending?.(pendingBookingId)}
                  >
                    {t('bookingConfirm.confirm')}
                  </Button>
                  <Button
                    flex={1}
                    backgroundColor="$background"
                    borderWidth={1}
                    borderColor="$danger"
                    borderRadius="$3"
                    minHeight="$9"
                    disabled={isPendingActionBusy}
                    onPress={() => onDeclinePending?.(pendingBookingId)}
                  >
                    <Text color="$danger">{t('bookingConfirm.decline')}</Text>
                  </Button>
                </XStack>
              ) : null}
            </Button>
          );
        })}
      </YStack>
    </YStack>
  );
}
