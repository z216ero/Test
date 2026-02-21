import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { Button, Text, XStack, YStack } from 'tamagui';
import {
  confirmClientBooking,
  declineClientBooking,
  getClientBookingHistory,
  getClientUpcomingBookings,
  type ClientBooking,
} from '@api/bookingsApi';
import { ApiError } from '@api/core';
import { presentApiError } from '@api/ApiErrorPresenter';
import type { RootStackParamList } from '@app/navigation/types';
import { t } from '@i18n';
import { useAppMutation, useAppQuery } from '@query/hooks';
import { keys } from '@query/keys';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@ui/feedback/useToast';
import { AppIcon } from '@ui/AppIcon';
import { TabScrollView } from '@ui/layout/TabScrollView';
import { formatDateWithWeekdayRu, formatTimeRangeRu } from '@utils/datetime';

type Props = NativeStackScreenProps<RootStackParamList, 'BookingConfirm'>;

type BookingConfirmState = 'pending' | 'confirmed' | 'declined' | 'unavailable';

const getClientConfirmationStatus = (booking: ClientBooking): string => {
  const raw = (
    booking.slot as unknown as {
      clientConfirmationStatus?: string | null;
    }
  ).clientConfirmationStatus;
  return (raw ?? '').trim().toLowerCase();
};

const resolveState = (booking: ClientBooking): BookingConfirmState => {
  const confirmation = getClientConfirmationStatus(booking);
  const bookingStatus = (booking.slot.bookingStatus ?? booking.slot.status ?? '').trim().toLowerCase();
  const startTs = booking.slot.startsAtUtc ? Date.parse(booking.slot.startsAtUtc) : Number.NaN;
  const started = !Number.isNaN(startTs) && startTs <= Date.now();

  if (confirmation === 'confirmed') {
    return 'confirmed';
  }
  if (confirmation === 'declined' || bookingStatus === 'cancelled') {
    return 'declined';
  }
  if (started) {
    return 'unavailable';
  }
  return 'pending';
};

export function BookingConfirmScreen({ navigation, route }: Props) {
  const bookingId = route.params.bookingId;
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const upcomingQuery = useAppQuery({
    queryKey: keys.bookings.upcoming(),
    queryFn: ({ signal }) => getClientUpcomingBookings({ signal }),
  });

  const historyQuery = useAppQuery({
    queryKey: keys.bookings.history(),
    queryFn: ({ signal }) => getClientBookingHistory({ signal }),
  });

  const booking = useMemo(() => {
    const all = [...(upcomingQuery.data ?? []), ...(historyQuery.data ?? [])];
    return all.find((item) => item.slot.bookingId === bookingId) ?? null;
  }, [bookingId, historyQuery.data, upcomingQuery.data]);

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: keys.bookings.upcoming() });
    queryClient.invalidateQueries({ queryKey: keys.bookings.history() });
    queryClient.invalidateQueries({ queryKey: keys.pendingBookingConfirmationsCount() });
    queryClient.invalidateQueries({ queryKey: keys.pendingLinkRequestsCount() });
    queryClient.invalidateQueries({ queryKey: keys.home.upcoming('Client') });
  };

  const confirmMutation = useAppMutation({
    mutationFn: () => confirmClientBooking(bookingId),
    onSuccess: () => {
      refreshAll();
      showToast({ type: 'success', title: t('bookingConfirm.confirmed') });
    },
    onError: (error) => {
      const presented = presentApiError(error);
      showToast({ type: 'error', title: presented.title, message: presented.message });
    },
  });

  const declineMutation = useAppMutation({
    mutationFn: () => declineClientBooking(bookingId),
    onSuccess: () => {
      refreshAll();
      showToast({ type: 'success', title: t('bookingConfirm.declined') });
    },
    onError: (error) => {
      const presented = presentApiError(error);
      showToast({ type: 'error', title: presented.title, message: presented.message });
    },
  });

  const isLoading = upcomingQuery.isLoading || historyQuery.isLoading;
  const state = booking ? resolveState(booking) : 'unavailable';

  const startDate = booking?.slot.startsAtUtc ? new Date(booking.slot.startsAtUtc) : null;
  const duration = booking?.slot.durationMinutes ?? 0;
  const endDate = startDate && duration > 0
    ? new Date(startDate.getTime() + duration * 60 * 1000)
    : startDate;
  const dateLabel = startDate ? formatDateWithWeekdayRu(startDate) : t('common.empty');
  const timeLabel = startDate && endDate ? formatTimeRangeRu(startDate, endDate) : t('common.empty');
  const price = booking?.slot.trainerPricePerSession;

  const stateLabel = (() => {
    switch (state) {
      case 'confirmed':
        return t('bookingConfirm.stateConfirmed');
      case 'declined':
        return t('bookingConfirm.stateDeclined');
      case 'pending':
        return t('bookingConfirm.statePending');
      default:
        return t('bookingConfirm.stateUnavailable');
    }
  })();

  const canAct = state === 'pending' && !confirmMutation.isPending && !declineMutation.isPending;

  const showStartedError = (error: unknown): boolean =>
    error instanceof ApiError && error.status === 400;

  return (
    <YStack flex={1} backgroundColor="$backgroundSoft">
      <TabScrollView>
        <YStack padding="$6" gap="$4">
          <XStack alignItems="center" gap="$2">
            <Button unstyled onPress={() => navigation.goBack()}>
              <AppIcon name="chevronLeft" size={18} color="$muted" />
            </Button>
            <Text fontSize="$8" fontWeight="700" color="$text">
              {t('bookingConfirm.title')}
            </Text>
          </XStack>

          <YStack
            backgroundColor="$background"
            borderWidth={1}
            borderColor="$border"
            borderRadius="$5"
            padding="$4"
            gap="$2"
          >
            <Text fontSize="$3" color="$muted">
              {t('bookingConfirm.banner')}
            </Text>
            <Text fontSize="$4" fontWeight="700" color="$text">
              {stateLabel}
            </Text>
          </YStack>

          {isLoading ? (
            <Text fontSize="$3" color="$muted">{t('common.loading')}</Text>
          ) : null}

          {!isLoading && !booking ? (
            <Text fontSize="$3" color="$muted">{t('bookingConfirm.notFound')}</Text>
          ) : null}

          {booking ? (
            <YStack
              gap="$3"
              backgroundColor="$background"
              borderWidth={1}
              borderColor="$border"
              borderRadius="$5"
              padding="$4"
            >
              <Text fontSize="$4" fontWeight="700" color="$text">
                {booking.trainerName?.trim() || t('common.empty')}
              </Text>
              <Text fontSize="$3" color="$muted">{dateLabel}</Text>
              <Text fontSize="$3" color="$muted">{timeLabel}</Text>
              {booking.trainerCityName ? (
                <Text fontSize="$3" color="$muted">{booking.trainerCityName}</Text>
              ) : null}
              {typeof price === 'number' ? (
                <Text fontSize="$3" color="$muted">{t('slots.details.priceLabel', { price: `${price} ₽` })}</Text>
              ) : null}
            </YStack>
          ) : null}

          {state === 'unavailable' ? (
            <Text fontSize="$3" color="$danger">
              {t('bookingConfirm.started')}
            </Text>
          ) : null}

          {canAct ? (
            <YStack gap="$2">
              <Button
                backgroundColor="$accent"
                color="$accentText"
                borderRadius="$4"
                minHeight="$10"
                onPress={() => confirmMutation.mutate()}
                disabled={!canAct}
              >
                {confirmMutation.isPending ? t('common.loading') : t('bookingConfirm.confirm')}
              </Button>
              <Button
                backgroundColor="$background"
                borderWidth={1}
                borderColor="$danger"
                borderRadius="$4"
                minHeight="$10"
                onPress={() => declineMutation.mutate()}
                disabled={!canAct}
              >
                <Text color="$danger">
                  {declineMutation.isPending ? t('common.loading') : t('bookingConfirm.decline')}
                </Text>
              </Button>
            </YStack>
          ) : null}

          {showStartedError(confirmMutation.error) || showStartedError(declineMutation.error) ? (
            <Text fontSize="$3" color="$danger">
              {t('bookingConfirm.started')}
            </Text>
          ) : null}
        </YStack>
      </TabScrollView>
    </YStack>
  );
}

