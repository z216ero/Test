import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl } from 'react-native';
import { Button, Text, YStack } from 'tamagui';
import {
  cancelBooking,
  confirmClientBooking,
  declineClientBooking,
  getClientBookingHistory,
  getClientUpcomingBookings,
  type ClientBooking,
} from '@api/bookingsApi';
import { ApiError } from '@api/core';
import { presentApiError, shouldShowErrorToast } from '@api/ApiErrorPresenter';
import { t } from '@i18n';
import { onBookingCancelled } from '@notifications/orchestrator';
import { useAppMutation, useAppQuery } from '@query/hooks';
import { keys } from '@query/keys';
import { useToast } from '@ui/feedback/useToast';
import { Banner } from '@ui/feedback/Banner';
import { ErrorState } from '@ui/states/ErrorState';
import { LoadingState } from '@ui/states/LoadingState';
import { TabScrollView } from '@ui/layout/TabScrollView';
import { formatDateRu } from '@utils/datetime';
import { buildDateKey } from '@utils/localDate';
import { useQueryClient } from '@tanstack/react-query';
import {
  getBookingStatusType,
  getSlotTimes,
  isHistoryBooking,
  isUpcomingBooking,
} from '@app/components/bookings/bookingUtils';
import { BookingCard } from '@app/components/bookings/BookingCard';
import { BookingsTabSelector, type BookingTab } from '@app/components/bookings/BookingsTabSelector';
import type { BookingsStackParamList } from '@app/navigation/types';

type Props = NativeStackScreenProps<BookingsStackParamList, 'BookingsHome'>;

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
const LIVE_REFRESH_INTERVAL_MS = 15 * 1000;

export function BookingsScreen({ navigation, route }: Props) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<BookingTab>(route.params?.initialTab ?? 'upcoming');
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  const upcomingQuery = useAppQuery({
    queryKey: keys.bookings.upcoming(),
    queryFn: ({ signal }) => getClientUpcomingBookings({ signal }),
    refetchInterval: LIVE_REFRESH_INTERVAL_MS,
    refetchIntervalInBackground: true,
  });

  const historyQuery = useAppQuery({
    queryKey: keys.bookings.history(),
    queryFn: ({ signal }) => getClientBookingHistory({ signal }),
    refetchInterval: LIVE_REFRESH_INTERVAL_MS,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    if (route.params?.initialTab) {
      setActiveTab(route.params.initialTab);
    }
  }, [route.params?.initialTab]);

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

  const handleRefresh = async () => {
    setIsManualRefreshing(true);
    try {
      await Promise.allSettled([
        upcomingQuery.refetch(),
        historyQuery.refetch(),
      ]);
    } finally {
      setIsManualRefreshing(false);
    }
  };

  const upcomingItems = useMemo(
    () => (upcomingQuery.data ?? []).filter((item) => isUpcomingBooking(item.slot, nowTs)),
    [upcomingQuery.data, nowTs]
  );

  const historyItems = useMemo(
    () => (historyQuery.data ?? []).filter((item) => isHistoryBooking(item.slot, nowTs)),
    [historyQuery.data, nowTs]
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

  const pendingItems = useMemo(
    () =>
      upcomingFiltered.filter(
        (item) => getBookingStatusType(item.slot, nowTs) === 'pending_confirmation'
      ),
    [upcomingFiltered, nowTs]
  );

  const upcomingConfirmedItems = useMemo(
    () =>
      upcomingFiltered.filter((item) => getBookingStatusType(item.slot, nowTs) === 'booked'),
    [upcomingFiltered, nowTs]
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
    () => buildSections(upcomingConfirmedItems, 'asc'),
    [buildSections, upcomingConfirmedItems]
  );

  const pendingSections = useMemo(
    () => buildSections(pendingItems, 'asc'),
    [buildSections, pendingItems]
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
      queryClient.invalidateQueries({ queryKey: keys.slots.available(), exact: false });

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
      if (shouldShowErrorToast(presented)) {
        showToast({
          type: 'error',
          title: presented.title,
          message,
        });
      }

      queryClient.invalidateQueries({ queryKey: keys.bookings.upcoming() });
      queryClient.invalidateQueries({ queryKey: keys.bookings.history() });
      queryClient.invalidateQueries({ queryKey: keys.slots.available(), exact: false });
    },
  });

  const confirmMutation = useAppMutation({
    mutationFn: (bookingId: string) => confirmClientBooking(bookingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.bookings.upcoming() });
      queryClient.invalidateQueries({ queryKey: keys.bookings.history() });
      queryClient.invalidateQueries({ queryKey: keys.home.upcoming('Client') });
      queryClient.invalidateQueries({ queryKey: keys.pendingBookingConfirmationsCount() });
      showToast({ type: 'success', title: t('bookingConfirm.confirmed') });
    },
    onError: (error) => {
      const presented = presentApiError(error);
      if (shouldShowErrorToast(presented)) {
        showToast({ type: 'error', title: presented.title, message: presented.message });
      }
    },
  });

  const declineMutation = useAppMutation({
    mutationFn: (bookingId: string) => declineClientBooking(bookingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.bookings.upcoming() });
      queryClient.invalidateQueries({ queryKey: keys.bookings.history() });
      queryClient.invalidateQueries({ queryKey: keys.home.upcoming('Client') });
      queryClient.invalidateQueries({ queryKey: keys.pendingBookingConfirmationsCount() });
      showToast({ type: 'success', title: t('bookingConfirm.declined') });
    },
    onError: (error) => {
      const presented = presentApiError(error);
      if (shouldShowErrorToast(presented)) {
        showToast({ type: 'error', title: presented.title, message: presented.message });
      }
    },
  });
  const openBookingDetails = useCallback((booking: ClientBooking) => {
    navigation.navigate('BookingDetails', {
      slot: booking.slot,
      trainerName: booking.trainerName,
      trainerPhoneNumber: booking.trainerPhoneNumber,
      trainerGender: booking.trainerGender,
      trainerWorksWithGender: booking.trainerWorksWithGender,
      trainerRating: booking.trainerRating,
      trainerSpecializations: booking.trainerSpecializations,
      trainerTrainingTypes: booking.trainerTrainingTypes,
      trainerCityName: booking.trainerCityName,
      trainerDistrictName: booking.trainerDistrictName,
      trainerAvatarUrl: booking.trainerAvatarUrl,
      paymentStatus: booking.paymentStatus,
    });
  }, [navigation]);

  const renderSection = (section: BookingSection, showActions: boolean) => (
    <YStack key={section.key} gap="$3">
      <Text fontSize="$5" fontWeight="700" color="$text">
        {section.title}
      </Text>
      <YStack gap="$4">
        {section.items.map((booking) => {
          const key = booking.slot.id ?? `${booking.slot.startsAtUtc ?? 'booking'}`;
          const isCancelling = Boolean(
            booking.slot.id
            && cancelMutation.isPending
            && cancelMutation.variables === booking.slot.id
          );
          const isConfirming = Boolean(
            booking.slot.bookingId
            && confirmMutation.isPending
            && confirmMutation.variables === booking.slot.bookingId
          );
          const isDeclining = Boolean(
            booking.slot.bookingId
            && declineMutation.isPending
            && declineMutation.variables === booking.slot.bookingId
          );
          return showActions
            ? (
              <BookingCard
                key={key}
                booking={booking}
                nowTs={nowTs}
                showActions
                isCancelling={isCancelling}
                isConfirming={isConfirming}
                isDeclining={isDeclining}
                onCancel={(slotId) => cancelMutation.mutate(slotId)}
                onConfirm={(bookingId) => confirmMutation.mutate(bookingId)}
                onDecline={(bookingId) => declineMutation.mutate(bookingId)}
                onOpenDetails={openBookingDetails}
              />
            )
            : (
              <Button
                key={key}
                unstyled
                onPress={() => openBookingDetails(booking)}
              >
                <BookingCard
                  booking={booking}
                  nowTs={nowTs}
                  showActions={false}
                  isCancelling={false}
                  isConfirming={false}
                  isDeclining={false}
                  onOpenDetails={openBookingDetails}
                />
              </Button>
            );
        })}
      </YStack>
    </YStack>
  );

  const activeItems =
    activeTab === 'upcoming'
      ? upcomingConfirmedItems
      : activeTab === 'pending'
        ? pendingItems
        : historyItems;
  const activeSections =
    activeTab === 'upcoming'
      ? upcomingSections
      : activeTab === 'pending'
        ? pendingSections
        : historySections;
  const activeError =
    activeTab === 'history' ? historyQuery.error : upcomingQuery.error;
  const activeLoading =
    activeTab === 'history' ? historyQuery.isLoading : upcomingQuery.isLoading;
  const activeFetching =
    activeTab === 'history' ? historyQuery.isFetching : upcomingQuery.isFetching;

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
              : activeTab === 'pending'
                ? t('bookings.emptyPendingTitle')
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
          renderSection(section, activeTab !== 'history')
        )}
      </YStack>
    );
  };

  return (
    <YStack flex={1} backgroundColor="$backgroundSoft">
      <TabScrollView
        refreshControl={
          <RefreshControl
            refreshing={isManualRefreshing && activeFetching && !activeLoading}
            onRefresh={handleRefresh}
          />
        }
      >
        <YStack gap="$4" padding="$6">
          <Text fontSize="$8" fontWeight="700" color="$text">
            {t('bookings.title')}
          </Text>
          <BookingsTabSelector
            activeTab={activeTab}
            pendingCount={pendingItems.length}
            onChangeTab={setActiveTab}
          />
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



