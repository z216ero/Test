import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { RefreshControl } from 'react-native';
import { ScrollView } from '@tamagui/scroll-view';
import { Button, Text, XStack, YStack } from 'tamagui';
import { cancelBooking, getMyBookings } from '../../api/bookingsApi';
import type { ClientBooking } from '../../api/bookingsApi';
import { getUiErrorMessage } from '../../api/core';
import { t } from '../../i18n';
import { formatDateRu, formatTimeRangeRu } from '../../utils/datetime';
import { onBookingCancelled } from '../../notifications/orchestrator';

type ViewState = 'loading' | 'ready' | 'error';

type BookingSection = {
  title: string;
  items: ClientBooking[];
  emptyKey: 'bookings.emptyUpcoming' | 'bookings.emptyPast';
};

const getSlotTimes = (slot: ClientBooking['slot']) => {
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
};

const getStatusLabel = (status?: string | null) => {
  switch (status) {
    case 'Booked':
      return t('bookings.statusBooked');
    case 'Cancelled':
      return t('bookings.statusCancelled');
    case 'Completed':
      return t('bookings.statusCompleted');
    case 'NoShow':
      return t('bookings.statusNoShow');
    default:
      return t('bookings.statusUnknown');
  }
};

export function BookingsScreen() {
  const [state, setState] = useState<ViewState>('loading');
  const [bookings, setBookings] = useState<ClientBooking[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) {
      setState('loading');
    }
    setError(null);

    try {
      const data = await getMyBookings();
      setBookings(data);
      setState('ready');
    } catch (err) {
      setError(getUiErrorMessage(err));
      setState('error');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  const sections = useMemo(() => {
    const now = Date.now();
    const upcoming: ClientBooking[] = [];
    const past: ClientBooking[] = [];

    bookings.forEach((booking) => {
      const slot = booking.slot;
      const start = slot.startsAtUtc
        ? new Date(slot.startsAtUtc).getTime()
        : 0;
      if (start >= now) {
        upcoming.push(booking);
      } else {
        past.push(booking);
      }
    });

    upcoming.sort((a, b) => {
      const aTime = a.slot.startsAtUtc
        ? new Date(a.slot.startsAtUtc).getTime()
        : 0;
      const bTime = b.slot.startsAtUtc
        ? new Date(b.slot.startsAtUtc).getTime()
        : 0;
      return aTime - bTime;
    });

    past.sort((a, b) => {
      const aTime = a.slot.startsAtUtc
        ? new Date(a.slot.startsAtUtc).getTime()
        : 0;
      const bTime = b.slot.startsAtUtc
        ? new Date(b.slot.startsAtUtc).getTime()
        : 0;
      return bTime - aTime;
    });

    return [
      {
        title: t('bookings.upcoming'),
        items: upcoming,
        emptyKey: 'bookings.emptyUpcoming',
      },
      {
        title: t('bookings.past'),
        items: past,
        emptyKey: 'bookings.emptyPast',
      },
    ] satisfies BookingSection[];
  }, [bookings]);

  const handleCancel = async (slotId: string) => {
    setCancellingId(slotId);
    setActionError(null);

    try {
      await cancelBooking(slotId);
      const booking = bookings.find((item) => item.slot.id === slotId);
      await onBookingCancelled({
        bookingId: slotId,
        startAtUtcIso: booking?.slot.startsAtUtc ?? undefined,
      });
      await load(true);
    } catch (err) {
      setActionError(getUiErrorMessage(err));
    } finally {
      setCancellingId(null);
    }
  };

  const renderBookingCard = (booking: ClientBooking, index: number) => {
    const { slot, trainerName, trainerSpecialization } = booking;
    const times = getSlotTimes(slot);
    const dateLabel = times ? formatDateRu(times.start) : '';
    const timeLabel = times
      ? formatTimeRangeRu(times.start, times.end)
      : '';
    const statusLabel = getStatusLabel(slot.status);
    const canCancel = slot.status === 'Booked' && !!slot.id;
    const isCancelling = slot.id ? cancellingId === slot.id : false;

    return (
      <YStack
        key={slot.id ?? `${slot.startsAtUtc ?? 'booking'}-${index}`}
        gap="$3"
        padding="$4"
        backgroundColor="$background"
        borderRadius="$5"
        borderWidth={1}
        borderColor="$border"
      >
        <XStack justifyContent="space-between" alignItems="center">
          <Text fontSize="$4" fontWeight="700" color="$text">
            {timeLabel || t('common.empty')}
          </Text>
          <XStack
            paddingHorizontal="$3"
            paddingVertical="$1"
            backgroundColor="$surfaceMuted"
            borderRadius="$3"
          >
            <Text fontSize="$2" color="$muted">
              {statusLabel}
            </Text>
          </XStack>
        </XStack>
        <Text fontSize="$3" color="$muted">
          {dateLabel || t('common.empty')}
        </Text>
        {trainerName ? (
          <YStack gap="$1">
            <Text fontSize="$4" fontWeight="700" color="$text">
              {trainerName}
            </Text>
            {trainerSpecialization ? (
              <Text fontSize="$3" color="$muted">
                {trainerSpecialization}
              </Text>
            ) : null}
          </YStack>
        ) : null}
        {canCancel ? (
          <XStack justifyContent="flex-end">
            <Button
              backgroundColor="$background"
              borderRadius="$4"
              borderWidth={1}
              borderColor="$border"
              minHeight="$9"
              paddingHorizontal="$4"
              onPress={() => handleCancel(slot.id as string)}
              disabled={isCancelling}
            >
              <Text color="$text">
                {isCancelling ? t('common.loading') : t('bookings.cancel')}
              </Text>
            </Button>
          </XStack>
        ) : null}
      </YStack>
    );
  };

  const renderSection = (section: BookingSection) => (
    <YStack key={section.title} gap="$3">
      <Text fontSize="$5" fontWeight="700" color="$text">
        {section.title}
      </Text>
      {section.items.length === 0 ? (
        <YStack
          padding="$4"
          backgroundColor="$background"
          borderRadius="$5"
          borderWidth={1}
          borderColor="$border"
        >
          <Text fontSize="$3" color="$muted">
            {t(section.emptyKey)}
          </Text>
        </YStack>
      ) : (
        <YStack gap="$4">
          {section.items.map(renderBookingCard)}
        </YStack>
      )}
    </YStack>
  );

  const renderContent = () => {
    if (state === 'loading') {
      return (
        <YStack gap="$3">
          <YStack height="$12" backgroundColor="$surfaceMuted" borderRadius="$5" />
          <YStack height="$12" backgroundColor="$surfaceMuted" borderRadius="$5" />
        </YStack>
      );
    }

    if (state === 'error') {
      return (
        <YStack
          gap="$3"
          padding="$5"
          backgroundColor="$background"
          borderRadius="$5"
          borderWidth={1}
          borderColor="$border"
        >
          <Text fontSize="$3" color="$muted">
            {error ?? t('errors.generic')}
          </Text>
          <Button
            backgroundColor="$accent"
            color="$accentText"
            borderRadius="$4"
            minHeight="$9"
            paddingHorizontal="$4"
            onPress={() => load()}
          >
            {t('common.retry')}
          </Button>
        </YStack>
      );
    }

    return (
      <YStack gap="$6">
        {sections.map(renderSection)}
        {actionError ? (
          <Text fontSize="$3" color="$primary">
            {actionError}
          </Text>
        ) : null}
      </YStack>
    );
  };

  return (
    <YStack flex={1} backgroundColor="$backgroundSoft">
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <YStack flex={1} padding="$6" gap="$4">
          <YStack gap="$2">
            <Text fontSize="$8" fontWeight="700" color="$text">
              {t('bookings.title')}
            </Text>
            <Text fontSize="$4" color="$muted">
              {t('bookings.subtitle')}
            </Text>
          </YStack>
          {renderContent()}
        </YStack>
      </ScrollView>
    </YStack>
  );
}
