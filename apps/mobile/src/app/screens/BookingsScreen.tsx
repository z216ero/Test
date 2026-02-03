import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl } from 'react-native';
import { Button, Text, XStack, YStack } from 'tamagui';
import {
  cancelBooking,
  getClientBookingHistory,
  getClientUpcomingBookings,
  type ClientBooking,
} from '@api/bookingsApi';
import { ApiError } from '@api/core';
import { presentApiError } from '@api/ApiErrorPresenter';
import { t } from '@i18n';
import { onBookingCancelled } from '@notifications/orchestrator';
import { useAppMutation, useAppQuery } from '@query/hooks';
import { keys } from '@query/keys';
import { useToast } from '@ui/feedback/useToast';
import { Banner } from '@ui/feedback/Banner';
import { ErrorState } from '@ui/states/ErrorState';
import { LoadingState } from '@ui/states/LoadingState';
import { TabScrollView } from '@ui/layout/TabScrollView';
import { formatDateRu, formatTimeRangeRu } from '@utils/datetime';
import { useQueryClient } from '@tanstack/react-query';
import {
  bookingStatusMeta,
  canCancelBooking,
  getBookingStatusType,
  getSlotTimes,
  isHistoryBooking,
  isUpcomingBooking,
} from '@app/components/bookings/bookingUtils';
import { TrainerAvatar } from '@app/components/bookings/TrainerAvatar';
import type { BookingsStackParamList } from '@app/navigation/types';

type Props = NativeStackScreenProps<BookingsStackParamList, 'BookingsHome'>;

type BookingTab = 'upcoming' | 'history';

type BookingSection = {
  key: string;
  title: string;
  items: ClientBooking[];
};

type CancelContext = {
  upcomingSnapshot?: ClientBooking[];
  historySnapshot?: ClientBooking[];
  cancelled?: ClientBooking | null;
};

const NOW_REFRESH_INTERVAL_MS = 60 * 1000;

const buildDateKey = (value: Date): string => {
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${value.getFullYear()}-${month}-${day}`;
};

export function BookingsScreen({ navigation }: Props) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<BookingTab>('upcoming');
  const [nowTs, setNowTs] = useState(() => Date.now());

  const upcomingQuery = useAppQuery({
    queryKey: keys.bookings.upcoming(),
    queryFn: ({ signal }) => getClientUpcomingBookings({ signal }),
  });

  const historyQuery = useAppQuery({
    queryKey: keys.bookings.history(),
    queryFn: ({ signal }) => getClientBookingHistory({ signal }),
  });

  useFocusEffect(
    useCallback(() => {
      setNowTs(Date.now());
      const intervalId = setInterval(() => {
        setNowTs(Date.now());
      }, NOW_REFRESH_INTERVAL_MS);
      return () => clearInterval(intervalId);
    }, [])
  );

  const { refetch: refetchUpcoming } = upcomingQuery;
  const { refetch: refetchHistory } = historyQuery;

  useFocusEffect(
    useCallback(() => {
      refetchUpcoming();
      refetchHistory();
    }, [refetchUpcoming, refetchHistory])
  );

  const handleRefresh = () => {
    upcomingQuery.refetch();
    historyQuery.refetch();
  };

  const upcomingItems = useMemo(
    () => (upcomingQuery.data ?? []).filter((item) => isUpcomingBooking(item.slot, nowTs)),
    [upcomingQuery.data, nowTs]
  );

  const historyItems = useMemo(
    () => (historyQuery.data ?? []).filter((item) => isHistoryBooking(item.slot)),
    [historyQuery.data]
  );

  const historyIds = useMemo(() => {
    const set = new Set<string>();
    historyItems.forEach((item) => {
      if (item.slot.id) {
        set.add(item.slot.id);
      }
    });
    return set;
  }, [historyItems]);

  const upcomingFiltered = useMemo(
    () => upcomingItems.filter((item) => !item.slot.id || !historyIds.has(item.slot.id)),
    [upcomingItems, historyIds]
  );

  const buildSections = useCallback((items: ClientBooking[], order: 'asc' | 'desc') => {
    const sorted = items.slice().sort((a, b) => {
      const aTime = a.slot.startsAtUtc ? new Date(a.slot.startsAtUtc).getTime() : 0;
      const bTime = b.slot.startsAtUtc ? new Date(b.slot.startsAtUtc).getTime() : 0;
      return order === 'asc' ? aTime - bTime : bTime - aTime;
    });

    const sections: BookingSection[] = [];
    sorted.forEach((item) => {
      const times = getSlotTimes(item.slot);
      const title = times ? formatDateRu(times.start) : t('common.empty');
      const key = times ? buildDateKey(times.start) : `${item.slot.id ?? title}`;

      const last = sections[sections.length - 1];
      if (!last || last.key !== key) {
        sections.push({ key, title, items: [item] });
        return;
      }
      last.items.push(item);
    });

    return sections;
  }, []);

  const upcomingSections = useMemo(
    () => buildSections(upcomingFiltered, 'asc'),
    [buildSections, upcomingFiltered]
  );

  const historySections = useMemo(
    () => buildSections(historyItems, 'desc'),
    [buildSections, historyItems]
  );

  const cancelMutation = useAppMutation<void, unknown, string, CancelContext>({
    mutationFn: (slotId: string) => cancelBooking(slotId),
    onMutate: async (slotId) => {
      await queryClient.cancelQueries({ queryKey: keys.bookings.upcoming() });
      await queryClient.cancelQueries({ queryKey: keys.bookings.history() });

      const upcomingSnapshot = queryClient.getQueryData<ClientBooking[]>(keys.bookings.upcoming());
      const historySnapshot = queryClient.getQueryData<ClientBooking[]>(keys.bookings.history());

      const cancelled = upcomingSnapshot?.find((item) => item.slot.id === slotId) ?? null;

      queryClient.setQueryData<ClientBooking[]>(
        keys.bookings.upcoming(),
        (current) => current?.filter((item) => item.slot.id !== slotId)
      );

      return { upcomingSnapshot, historySnapshot, cancelled };
    },
    onSuccess: async (_data, slotId, context) => {
      if (context?.cancelled?.slot.startsAtUtc) {
        await onBookingCancelled({
          bookingId: slotId,
          startAtUtcIso: context.cancelled.slot.startsAtUtc,
        });
      }

      queryClient.invalidateQueries({ queryKey: keys.bookings.upcoming() });
      queryClient.invalidateQueries({ queryKey: keys.bookings.history() });
      queryClient.invalidateQueries({ queryKey: keys.home.upcoming('Client') });

      showToast({ type: 'success', title: t('bookings.detailsCancelled') });
    },
    onError: (err, _slotId, context) => {
      if (context?.upcomingSnapshot) {
        queryClient.setQueryData(keys.bookings.upcoming(), context.upcomingSnapshot);
      }
      if (context?.historySnapshot) {
        queryClient.setQueryData(keys.bookings.history(), context.historySnapshot);
      }

      const presented = presentApiError(err);
      const message = err instanceof ApiError ? err.message : presented.message;
      showToast({
        type: 'error',
        title: presented.title,
        message,
      });

      queryClient.invalidateQueries({ queryKey: keys.bookings.upcoming() });
      queryClient.invalidateQueries({ queryKey: keys.bookings.history() });
    },
  });

  const renderCard = (
    booking: ClientBooking,
    showActions: boolean,
    key: string
  ) => {
    const times = getSlotTimes(booking.slot);
    const timeLabel = times ? formatTimeRangeRu(times.start, times.end) : t('common.empty');
    const statusType = getBookingStatusType(booking.slot);
    const statusMeta = bookingStatusMeta[statusType];
    const statusLabel = t(statusMeta.labelKey);
    const canCancel = booking.slot.id ? canCancelBooking(booking.slot, nowTs) : false;
    const isCancelling = Boolean(
      booking.slot.id
      && cancelMutation.isPending
      && cancelMutation.variables === booking.slot.id
    );

    return (
      <YStack
        key={key}
        gap="$3"
        padding="$4"
        backgroundColor="$background"
        borderRadius="$5"
        borderWidth={1}
        borderColor="$border"
      >
        <XStack justifyContent="space-between" alignItems="center">
          <Text fontSize="$4" fontWeight="700" color="$text">
            {timeLabel}
          </Text>
          <XStack alignItems="center" gap="$2">
            <YStack
              width="$1"
              height="$1"
              borderRadius="$6"
              backgroundColor={statusMeta.color}
            />
            <Text fontSize="$2" color={statusMeta.color}>
              {statusLabel}
            </Text>
          </XStack>
        </XStack>
        <XStack alignItems="center" gap="$3">
          <TrainerAvatar
            name={booking.trainerName}
            avatarUrl={booking.trainerAvatarUrl}
            size="$9"
          />
          <YStack gap="$1" flex={1}>
            <Text fontSize="$4" fontWeight="700" color="$text">
              {booking.trainerName?.trim() || t('common.empty')}
            </Text>
            {booking.trainerSpecialization ? (
              <Text fontSize="$3" color="$muted">
                {booking.trainerSpecialization}
              </Text>
            ) : null}
          </YStack>
        </XStack>
        {showActions ? (
          <XStack justifyContent="flex-end" gap="$2">
            {canCancel ? (
              <Button
                backgroundColor="$background"
                borderRadius="$4"
                borderWidth={1}
                borderColor="$border"
                minHeight="$9"
                paddingHorizontal="$4"
                onPress={() => booking.slot.id && cancelMutation.mutate(booking.slot.id)}
                disabled={isCancelling}
              >
                <Text color="$danger">
                  {isCancelling ? t('common.loading') : t('bookings.cancel')}
                </Text>
              </Button>
            ) : null}
            <Button
              backgroundColor="$background"
              borderRadius="$4"
              borderWidth={1}
              borderColor="$border"
              minHeight="$9"
              paddingHorizontal="$4"
              onPress={() => {
                navigation.navigate('BookingDetails', {
                  slot: booking.slot,
                  trainerName: booking.trainerName,
                  trainerSpecialization: booking.trainerSpecialization,
                  trainerAvatarUrl: booking.trainerAvatarUrl,
                });
              }}
            >
              <Text color="$text">{t('bookings.action.details')}</Text>
            </Button>
          </XStack>
        ) : null}
      </YStack>
    );
  };

  const renderSection = (section: BookingSection, showActions: boolean) => (
    <YStack key={section.key} gap="$3">
      <Text fontSize="$5" fontWeight="700" color="$text">
        {section.title}
      </Text>
      <YStack gap="$4">
        {section.items.map((booking) => {
          const key = booking.slot.id ?? `${booking.slot.startsAtUtc ?? 'booking'}`;
          return showActions
            ? renderCard(booking, true, key)
            : (
              <Button
                key={key}
                unstyled
                onPress={() => {
                navigation.navigate('BookingDetails', {
                  slot: booking.slot,
                  trainerName: booking.trainerName,
                  trainerSpecialization: booking.trainerSpecialization,
                  trainerAvatarUrl: booking.trainerAvatarUrl,
                });
              }}
            >
                {renderCard(booking, false, key)}
              </Button>
            );
        })}
      </YStack>
    </YStack>
  );

  const activeItems = activeTab === 'upcoming' ? upcomingFiltered : historyItems;
  const activeSections = activeTab === 'upcoming' ? upcomingSections : historySections;
  const activeError = activeTab === 'upcoming' ? upcomingQuery.error : historyQuery.error;
  const activeLoading = activeTab === 'upcoming' ? upcomingQuery.isLoading : historyQuery.isLoading;
  const activeFetching = activeTab === 'upcoming' ? upcomingQuery.isFetching : historyQuery.isFetching;

  const presentedError = activeError ? presentApiError(activeError) : null;
  const isNetworkError = presentedError
    ? presentedError.kind === 'network' || presentedError.kind === 'timeout'
    : false;

  const renderContent = () => {
    if (activeLoading && activeItems.length === 0) {
      return <LoadingState />;
    }

    if (activeError && activeItems.length === 0 && !isNetworkError) {
      return <ErrorState error={activeError} onRetry={handleRefresh} />;
    }

    if (activeItems.length === 0) {
      return (
        <YStack
          padding="$5"
          backgroundColor="$background"
          borderRadius="$5"
          borderWidth={1}
          borderColor="$border"
          alignItems="center"
          gap="$3"
          height="120"
        >
          <Text fontSize="$4" fontWeight="600" color="$text" textAlign="center">
            {activeTab === 'upcoming'
              ? t('bookings.emptyUpcomingTitle')
              : t('bookings.emptyHistoryTitle')}
          </Text>
          {activeTab === 'upcoming' ? (
            <Button
              backgroundColor="$accent"
              color="$accentText"
              borderRadius="$4"
              minHeight="$9"
              paddingHorizontal="$4"
              onPress={() => navigation.getParent()?.navigate('Slots', { screen: 'SlotsList' })}
            >
              {t('bookings.emptyUpcomingCta')}
            </Button>
          ) : null}
        </YStack>
      );
    }

    return (
      <YStack gap="$6">
        {activeSections.map((section) =>
          renderSection(section, activeTab === 'upcoming')
        )}
      </YStack>
    );
  };

  return (
    <YStack flex={1} backgroundColor="$backgroundSoft">
      <TabScrollView
        refreshControl={
          <RefreshControl
            refreshing={activeFetching && !activeLoading}
            onRefresh={handleRefresh}
          />
        }
      >
        <YStack gap="$4" padding="$6">
          <Text fontSize="$8" fontWeight="700" color="$text">
            {t('bookings.title')}
          </Text>
          <XStack
            padding="$1"
            backgroundColor="$surfaceMuted"
            borderRadius="$4"
            borderWidth={1}
            borderColor="$border"
            gap="$1"
          >
            {([
              { id: 'upcoming', label: t('bookings.upcoming') },
              { id: 'history', label: t('bookings.past') },
            ] as const).map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <Button
                  key={tab.id}
                  unstyled
                  flex={1}
                  paddingVertical="$2"
                  borderRadius="$3"
                  backgroundColor={isActive ? '$background' : 'transparent'}
                  onPress={() => setActiveTab(tab.id)}
                >
                  <Text
                    fontSize="$3"
                    fontWeight={isActive ? '700' : '600'}
                    color={isActive ? '$text' : '$muted'}
                    textAlign="center"
                  >
                    {tab.label}
                  </Text>
                </Button>
              );
            })}
          </XStack>
          {isNetworkError && presentedError ? (
            <Banner
              type="error"
              title={presentedError.title}
              message={presentedError.message}
              actionLabel={t('common.retry')}
              onAction={handleRefresh}
            />
          ) : null}
          {renderContent()}
        </YStack>
      </TabScrollView>
    </YStack>
  );
}



