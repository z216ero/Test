import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { Button, Text, XStack, YStack } from 'tamagui';
import type { ClientBooking } from '@api/bookingsApi';
import {
  BookingConflictError,
  BookingTimeConflictError,
  createBooking,
  getClientUpcomingBookings,
} from '@api/bookingsApi';
import { presentApiError } from '@api/ApiErrorPresenter';
import { t } from '@i18n';
import { onBookingCreated } from '@notifications/orchestrator';
import { useAppMutation, useAppQuery } from '@query/hooks';
import { keys } from '@query/keys';
import { useToast } from '@ui/feedback/useToast';
import { Banner } from '@ui/feedback/Banner';
import { TrainerAvatar } from '@app/components/bookings/TrainerAvatar';
import { formatDateWithWeekdayRu, formatTimeRangeRu } from '@utils/datetime';
import { formatPrice } from '@utils/price';
import { useQueryClient } from '@tanstack/react-query';
import { AppIcon } from '@ui/AppIcon';
import type { SlotDto } from '@generated/api';
import type { SlotsStackParamList } from '@app/navigation/types';
import { TabScrollView } from '@ui/layout/TabScrollView';

const normalizeStatus = (value?: string | null) => value?.toLowerCase().trim();

const isSlotOpen = (slot: SlotDto) => {
  const normalized = normalizeStatus(slot.status);
  return normalized === 'open' || normalized === 'available';
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
    const bookingRange = booking.slot ? getSlotRange(booking.slot) : null;
    if (!bookingRange) {
      return false;
    }
    return slotRange.start < bookingRange.end && bookingRange.start < slotRange.end;
  });
};

type Props = NativeStackScreenProps<SlotsStackParamList, 'ClientSlotDetails'>;

export function ClientSlotDetailsScreen({ navigation, route }: Props) {
  const { slot, trainer } = route.params;
  const [actionError, setActionError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const bookingsQuery = useAppQuery({
    queryKey: keys.bookings.upcoming(),
    queryFn: ({ signal }) => getClientUpcomingBookings({ signal }),
  });

  const bookings = bookingsQuery.data ?? [];

  const times = useMemo(() => {
    if (!slot.startsAtUtc) {
      return null;
    }
    const start = new Date(slot.startsAtUtc);
    if (Number.isNaN(start.getTime())) {
      return null;
    }
    const duration = slot.durationMinutes ?? 0;
    const end = duration
      ? new Date(start.getTime() + duration * 60 * 1000)
      : start;
    return { start, end };
  }, [slot]);

  const dateLabel = times ? formatDateWithWeekdayRu(times.start) : t('common.empty');
  const timeLabel = times ? formatTimeRangeRu(times.start, times.end) : t('common.empty');
  const priceLabel = formatPrice(slot.trainerPricePerSession ?? trainer.pricePerSession);
  const conflict = hasTimeConflict(slot, bookings);
  const startTs = times?.start.getTime() ?? null;
  const isPast = startTs !== null && startTs <= Date.now();
  const open = isSlotOpen(slot);
  const hasValidTime = Boolean(times);

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
          startAtUtcIso: slot.startsAtUtc ?? '',
          title: trainer.name
            ? t('notifications.reminder.notificationTitleWithTrainer', { name: trainer.name })
            : t('notifications.reminder.notificationTitle'),
        });
      } catch (notificationError) {
        if (__DEV__) {
          console.warn('Failed to schedule booking notification', notificationError);
        }
      }

      showToast({ type: 'success', title: t('notifications.event.booked') });
      navigation.popToTop();
      navigation.getParent()?.navigate('Bookings', { screen: 'BookingsHome' });
    },
    onError: (err) => {
      const presented = presentApiError(err);
      if (err instanceof BookingTimeConflictError) {
        setActionError(t('errors.slotTimeConflict'));
      } else if (err instanceof BookingConflictError) {
        setActionError(t('errors.slotTaken'));
      } else {
        setActionError(presented.message);
      }

      showToast({
        type: 'error',
        title: presented.title,
        message: presented.message,
      });

      if (err instanceof BookingTimeConflictError || err instanceof BookingConflictError) {
        queryClient.invalidateQueries({ queryKey: keys.bookings.upcoming() });
        queryClient.invalidateQueries({ queryKey: keys.slots.available(), exact: false });
      }
    },
  });

  const isBookable = Boolean(slot.id) && hasValidTime && open && !isPast && !conflict;

  const disabledReason = (() => {
    if (!slot.id || !hasValidTime) {
      return t('slots.details.unavailable');
    }
    if (conflict) {
      return t('slots.conflictBanner');
    }
    if (!open) {
      return t('slots.details.unavailable');
    }
    if (isPast) {
      return t('slots.details.past');
    }
    return null;
  })();

  return (
    <YStack flex={1} backgroundColor="$backgroundSoft">
      <TabScrollView contentContainerStyle={{ padding: 24 }} extraBottom={72}>
        <YStack gap="$4">
          <Text fontSize="$8" fontWeight="700" color="$text">
            {t('slotDetails.title')}
          </Text>

          <YStack
            gap="$3"
            padding="$4"
            backgroundColor="$background"
            borderRadius="$5"
            borderWidth={1}
            borderColor="$border"
          >
            <XStack alignItems="center" gap="$3">
              <TrainerAvatar name={trainer.name} avatarUrl={trainer.avatarUrl} size="$10" />
              <YStack gap="$1" flex={1}>
                <Text fontSize="$5" fontWeight="700" color="$text">
                  {trainer.name ?? t('common.empty')}
                </Text>
                {trainer.rating ? (
                  <XStack alignItems="center" gap="$2">
                    <AppIcon name="star" size={14} color="$accent" />
                    <Text fontSize="$3" color="$muted">
                      {trainer.rating.toFixed(1)}
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
            {priceLabel ? (
              <Text fontSize="$4" color="$text">
                {t('slots.details.priceLabel', { price: priceLabel })}
              </Text>
            ) : null}
          </YStack>

          {conflict ? (
            <Banner type="error" title={t('slots.conflictBanner')} />
          ) : null}

          {actionError ? (
            <Banner type="error" title={actionError} />
          ) : null}

          <YStack gap="$3">
            <Button
              backgroundColor="$accent"
              color="$accentText"
              borderRadius="$4"
              minHeight="$9"
              paddingHorizontal="$4"
              width="100%"
              onPress={() => {
                if (!slot.id) {
                  setActionError(t('errors.generic'));
                  return;
                }
                setActionError(null);
                bookingMutation.mutate(slot.id);
              }}
              disabled={!isBookable || bookingMutation.isPending}
            >
              {bookingMutation.isPending ? t('common.loading') : t('slots.bookCta')}
            </Button>
            {!isBookable && disabledReason ? (
              <Text fontSize="$3" color="$muted">
                {disabledReason}
              </Text>
            ) : null}
            <Button
              alignSelf="center"
              backgroundColor="$background"
              borderRadius="$4"
              borderWidth={1}
              borderColor="$border"
              minHeight="$9"
              paddingHorizontal="$4"
              onPress={() => navigation.goBack()}
            >
              <Text color="$text">{t('bookingConfirm.back')}</Text>
            </Button>
          </YStack>
        </YStack>
      </TabScrollView>
    </YStack>
  );
}
