import { useMemo, useState } from 'react';
import { Sheet } from '@tamagui/sheet';
import { Button, Text, XStack, YStack } from 'tamagui';
import type { AvailableSlotTrainerDto, SlotDto } from '@generated/api';
import type { ClientBooking } from '@api/bookingsApi';
import {
  BookingConflictError,
  BookingNotFoundError,
  BookingSlotFullError,
  BookingTimeConflictError,
  cancelBooking,
  createBooking,
} from '@api/bookingsApi';
import { presentApiError, shouldShowErrorToast } from '@api/ApiErrorPresenter';
import { t } from '@i18n';
import { onBookingCreated } from '@notifications/orchestrator';
import { useAppMutation } from '@query/hooks';
import { keys } from '@query/keys';
import { useToast } from '@ui/feedback/useToast';
import { Banner } from '@ui/feedback/Banner';
import { AppIcon } from '@ui/AppIcon';
import { formatDateWithWeekdayRu, formatTimeRangeRu } from '@utils/datetime';
import { formatPrice } from '@utils/price';
import { useQueryClient } from '@tanstack/react-query';
import { TrainerAvatar } from '@app/components/bookings/TrainerAvatar';
import { getSlotWorkoutType } from '@api/workoutTypesApi';
import { WorkoutTypeChip } from '@app/components/workout/WorkoutTypeChip';

type ClientSlotDetailsSheetProps = {
  open: boolean;
  slot: SlotDto | null;
  trainer: AvailableSlotTrainerDto | null;
  bookings: ClientBooking[];
  canCheckConflicts: boolean;
  nowTs: number;
  onOpenChange: (open: boolean) => void;
  onBooked?: () => void;
};

const hiddenOverlayStyle = { opacity: 0 } as const;

const normalizeStatus = (value?: string | null) => value?.toLowerCase().trim();

const isSlotOpen = (slot: SlotDto) => {
  const normalized = normalizeStatus(slot.status);
  return normalized === 'open' || normalized === 'available';
};

const isGroupSlot = (slot: SlotDto) =>
  (slot.slotType ?? '').toLowerCase() === 'group';

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

export function ClientSlotDetailsSheet({
  open,
  slot,
  trainer,
  bookings,
  canCheckConflicts,
  nowTs,
  onOpenChange,
  onBooked,
}: ClientSlotDetailsSheetProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [actionError, setActionError] = useState<string | null>(null);

  const isReady = Boolean(slot && trainer);
  const activeSlot = slot;
  const activeTrainer = trainer;
  const isBookedThisSlot = Boolean(activeSlot?.id)
    && bookings.some((booking) => booking.slot.id === activeSlot?.id);

  const times = useMemo(() => {
    if (!activeSlot?.startsAtUtc) {
      return null;
    }
    const start = new Date(activeSlot.startsAtUtc);
    if (Number.isNaN(start.getTime())) {
      return null;
    }
    const duration = activeSlot.durationMinutes ?? 0;
    const end = duration
      ? new Date(start.getTime() + duration * 60 * 1000)
      : start;
    return { start, end };
  }, [activeSlot]);

  const dateLabel = times ? formatDateWithWeekdayRu(times.start) : t('common.empty');
  const timeLabel = times ? formatTimeRangeRu(times.start, times.end) : t('common.empty');
  const priceLabel = isReady
    ? formatPrice(activeSlot?.trainerPricePerSession ?? activeTrainer?.pricePerSession)
    : null;
  const locationLabel = useMemo(() => {
    const parts = [activeTrainer?.cityName, activeTrainer?.districtName].filter(
      (value): value is string => !!value && value.trim().length > 0
    );
    return parts.length > 0 ? parts.join(', ') : null;
  }, [activeTrainer?.cityName, activeTrainer?.districtName]);
  const conflict = activeSlot
    ? canCheckConflicts && hasTimeConflict(activeSlot, bookings)
    : false;
  const startTs = times?.start.getTime() ?? null;
  const isPast = startTs !== null && startTs <= nowTs;
  const openForBooking = activeSlot ? isSlotOpen(activeSlot) : false;
  const hasValidTime = Boolean(times);
  const group = activeSlot ? isGroupSlot(activeSlot) : false;
  const occupiedCount = activeSlot?.occupiedCount ?? 0;
  const capacityMax = activeSlot?.capacityMax ?? null;
  const isFull = activeSlot?.isFull ?? (
    group
    && capacityMax !== null
    && occupiedCount >= capacityMax
  );
  const workoutType = activeSlot ? getSlotWorkoutType(activeSlot) : null;

  const bookingMutation = useAppMutation({
    mutationFn: (slotId: string) => createBooking(slotId),
    onSuccess: async (_data, slotId) => {
      queryClient.invalidateQueries({ queryKey: keys.bookings.upcoming() });
      queryClient.invalidateQueries({ queryKey: keys.bookings.history() });
      queryClient.invalidateQueries({ queryKey: keys.slots.available(), exact: false });
      queryClient.invalidateQueries({ queryKey: keys.home.upcoming('Client') });

      try {
        await onBookingCreated({
          bookingId: slotId,
          startAtUtcIso: activeSlot?.startsAtUtc ?? '',
          title: activeTrainer?.name
            ? t('notifications.reminder.notificationTitleWithTrainer', { name: activeTrainer.name })
            : t('notifications.reminder.notificationTitle'),
        });
      } catch (notificationError) {
        if (__DEV__) {
          console.warn('Failed to schedule booking notification', notificationError);
        }
      }

      onOpenChange(false);
      onBooked?.();
    },
    onError: (err) => {
      const presented = presentApiError(err);
      if (err instanceof BookingTimeConflictError) {
        setActionError(t('errors.slotTimeConflict'));
      } else if (err instanceof BookingSlotFullError) {
        setActionError(t('slots.status.full'));
      } else if (err instanceof BookingConflictError) {
        setActionError(t('errors.slotTaken'));
      } else {
        setActionError(presented.message);
      }

      if (shouldShowErrorToast(presented)) {
        showToast({
          type: 'error',
          title: presented.title,
          message: presented.message,
        });
      }

      if (
        err instanceof BookingTimeConflictError
        || err instanceof BookingConflictError
        || err instanceof BookingSlotFullError
      ) {
        queryClient.invalidateQueries({ queryKey: keys.bookings.upcoming() });
        queryClient.invalidateQueries({ queryKey: keys.slots.available(), exact: false });
      }
    },
  });

  const cancelMutation = useAppMutation({
    mutationFn: (slotId: string) => cancelBooking(slotId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.bookings.upcoming() });
      queryClient.invalidateQueries({ queryKey: keys.bookings.history() });
      queryClient.invalidateQueries({ queryKey: keys.slots.available(), exact: false });
      queryClient.invalidateQueries({ queryKey: keys.home.upcoming('Client') });
      onOpenChange(false);
    },
    onError: (err) => {
      const presented = presentApiError(err);
      if (err instanceof BookingNotFoundError) {
        setActionError(t('errors.slotNotFound'));
      } else {
        setActionError(presented.message);
      }
      if (shouldShowErrorToast(presented)) {
        showToast({
          type: 'error',
          title: presented.title,
          message: presented.message,
        });
      }
      queryClient.invalidateQueries({ queryKey: keys.bookings.upcoming() });
      queryClient.invalidateQueries({ queryKey: keys.slots.available(), exact: false });
    },
  });

  const isBookable = Boolean(activeSlot?.id)
    && hasValidTime
    && openForBooking
    && !isPast
    && !conflict
    && !isFull
    && !isBookedThisSlot;

  const disabledReason = (() => {
    if (!activeSlot?.id || !hasValidTime) {
      return t('slots.details.unavailable');
    }
    if (isBookedThisSlot) {
      return null;
    }
    if (conflict) {
      return t('slots.conflictBanner');
    }
    if (isFull) {
      return t('slots.status.full');
    }
    if (!openForBooking) {
      return t('slots.details.unavailable');
    }
    if (isPast) {
      return t('slots.details.past');
    }
    return null;
  })();

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      modal
      dismissOnSnapToBottom
      snapPoints={[42]}
      dismissOnOverlayPress
      zIndex={100_000}
    >
      <Sheet.Overlay
        animation="fast"
        enterStyle={hiddenOverlayStyle}
        exitStyle={hiddenOverlayStyle}
        backgroundColor="rgba(15, 23, 42, 0.2)"
        zIndex={100_000}
      />
      <Sheet.Frame
        padding="$5"
        paddingBottom="$7"
        gap="$4"
        backgroundColor="$backgroundSoft"
        borderTopWidth={1}
        borderTopColor="$border"
        borderTopLeftRadius="$6"
        borderTopRightRadius="$6"
        zIndex={100_001}
      >
        <Sheet.Handle />
        {isReady && activeSlot && activeTrainer ? (
          <YStack gap="$4">
            <YStack
              gap="$3"
              padding="$4"
              backgroundColor="$background"
              borderRadius="$5"
              borderWidth={1}
              borderColor="$border"
            >
              <XStack alignItems="center" gap="$3">
                <TrainerAvatar
                  name={activeTrainer.name}
                  avatarUrl={activeTrainer.avatarUrl}
                  size="$10"
                  trainerProfile={activeTrainer}
                  disableProfileSheet
                />
                <YStack gap="$1" flex={1}>
                  <Text fontSize="$5" fontWeight="700" color="$text">
                    {activeTrainer.name ?? t('common.empty')}
                  </Text>
                  {locationLabel ? (
                    <Text fontSize="$3" color="$muted">
                      {locationLabel}
                    </Text>
                  ) : null}
                  {activeTrainer.rating ? (
                    <XStack alignItems="center" gap="$2">
                      <AppIcon name="star" size={14} color="$accent" />
                      <Text fontSize="$3" color="$muted">
                        {activeTrainer.rating.toFixed(1)}
                      </Text>
                    </XStack>
                  ) : null}
                </YStack>
              </XStack>
            </YStack>

            <YStack
              gap="$3"
              padding="$4"
              backgroundColor="$background"
              borderRadius="$5"
              borderWidth={1}
              borderColor="$border"
            >
              <Text fontSize="$3" color="$muted">
                {dateLabel}
              </Text>
              <Text fontSize="$5" fontWeight="700" color="$text">
                {timeLabel}
              </Text>
              <XStack alignItems="center" gap="$2">
                <AppIcon name={group ? 'users' : 'user'} size={14} color="$muted" />
                {group && capacityMax ? (
                  <Text fontSize="$3" color="$muted">
                    {`${occupiedCount}/${capacityMax}`}
                  </Text>
                ) : null}
              </XStack>
              {priceLabel ? (
                <Text fontSize="$4" color="$text">
                  {t('slots.details.priceLabel', { price: priceLabel })}
                </Text>
              ) : null}
              <WorkoutTypeChip
                label={workoutType?.name}
                archived={Boolean(workoutType?.isArchived)}
              />
            </YStack>

            {conflict && !isBookedThisSlot ? (
              <Banner type="error" title={t('slots.conflictBanner')} />
            ) : null}
            {actionError ? (
              <Banner type="error" title={actionError} />
            ) : null}

            <YStack gap="$3">
              {isBookedThisSlot ? (
                <Button
                  backgroundColor="$background"
                  borderColor="$danger"
                  borderWidth={1}
                  color="$danger"
                  borderRadius="$4"
                  minHeight="$9"
                  paddingHorizontal="$4"
                  width="100%"
                  onPress={() => {
                    if (!activeSlot.id) {
                      setActionError(t('errors.generic'));
                      return;
                    }
                    setActionError(null);
                    cancelMutation.mutate(activeSlot.id);
                  }}
                  disabled={cancelMutation.isPending}
                >
                  {cancelMutation.isPending ? t('common.loading') : t('bookings.cancel')}
                </Button>
              ) : (
                <Button
                  backgroundColor="$accent"
                  color="$accentText"
                  borderRadius="$4"
                  minHeight="$9"
                  paddingHorizontal="$4"
                  width="100%"
                  onPress={() => {
                    if (!activeSlot.id) {
                      setActionError(t('errors.generic'));
                      return;
                    }
                    setActionError(null);
                    bookingMutation.mutate(activeSlot.id);
                  }}
                  disabled={!isBookable || bookingMutation.isPending}
                >
                  {bookingMutation.isPending ? t('common.loading') : t('slots.bookCta')}
                </Button>
              )}
              {!isBookable && disabledReason ? (
                <Text fontSize="$3" color="$muted">
                  {disabledReason}
                </Text>
              ) : null}
            </YStack>
          </YStack>
        ) : null}
      </Sheet.Frame>
    </Sheet>
  );
}
