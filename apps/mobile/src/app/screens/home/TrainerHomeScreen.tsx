import { useFocusEffect } from '@react-navigation/native';
import { type QueryKey, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl } from 'react-native';
import { Button, Text, XStack, YStack } from 'tamagui';
import {
  attendanceActionsAvailable,
  closeTrainerBooking,
  getMyTrainerSlots,
  type PaymentMethod,
} from '@api/trainerSlotsApi';
import { presentApiError, shouldShowErrorToast } from '@api/ApiErrorPresenter';
import type { SlotDto } from '@generated/api';
import { t } from '@i18n';
import { useAppMutation, useAppQuery } from '@query/hooks';
import { keys } from '@query/keys';
import { AppIcon } from '@ui/AppIcon';
import { useAuthorizedImageSource } from '@ui/components';
import { useToast } from '@ui/feedback/useToast';
import { useTabBarPadding } from '@ui/layout/useTabBarPadding';
import { TabScrollView } from '@ui/layout/TabScrollView';
import { SlotActionsSheet } from '@app/components/schedule/SlotActionsSheet';
import { formatTimeRangeRu } from '@utils/datetime';
import {
  canMarkCompleted,
  canMarkNoShow,
  getClientAvatarUrl,
  getClientName,
  getSlotStartTimestamp,
  getSlotTimes,
  isFreeSlotPast,
  getUiSlotStatus,
} from '@app/components/schedule/slotHelpers';
import type { HomeMeState, HomeNavigation, HomeUser } from './types';
import { TrainerHomeAlertsCard } from './trainer-home/ui/TrainerHomeAlertsCard';
import { TrainerAttendanceQueueCard } from './trainer-home/ui/TrainerAttendanceQueueCard';
import { TrainerHomeHeader } from './trainer-home/ui/TrainerHomeHeader';
import { TrainerNowNextCard } from './trainer-home/ui/TrainerNowNextCard';

const NOW_REFRESH_INTERVAL_MS = 30 * 1000;
const UPCOMING_ALERT_WINDOW_MS = 30 * 60 * 1000;
const FUTURE_HOME_RANGE_DAYS = 14;
const PAST_ATTENDANCE_RANGE_DAYS = 30;

const startOfLocalDay = (value: Date) =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0);

const endOfLocalDay = (value: Date) =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate(), 23, 59, 59, 999);

const addDays = (value: Date, days: number) => {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
};

const isSameLocalDay = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear()
  && left.getMonth() === right.getMonth()
  && left.getDate() === right.getDate();

const toStartOfLocalDayIso = (value: string): string | null => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return startOfLocalDay(parsed).toISOString();
};

const sortByStart = (a: SlotDto, b: SlotDto) => {
  const aTime = getSlotStartTimestamp(a) ?? 0;
  const bTime = getSlotStartTimestamp(b) ?? 0;
  return aTime - bTime;
};

const getRoundedMinutesUntil = (startTs: number, nowTs: number): number => {
  const diffMs = startTs - nowTs;
  if (diffMs <= 0) {
    return 0;
  }
  return Math.ceil(diffMs / (60 * 1000));
};

type TrainerHomeScreenProps = {
  navigation: HomeNavigation;
  me: HomeUser;
  meState: HomeMeState;
};

export function TrainerHomeScreen({ navigation, me, meState }: TrainerHomeScreenProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { tabBarHeight } = useTabBarPadding();
  const {
    isLoading: isMeLoading,
    isFetching: isMeFetching,
    error: meError,
    refetch: refetchMe,
  } = meState;

  const [todayDate, setTodayDate] = useState(() => startOfLocalDay(new Date()));
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [activeSlot, setActiveSlot] = useState<SlotDto | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  const dateRange = useMemo(() => {
    const startLocal = startOfLocalDay(todayDate);
    const endLocal = endOfLocalDay(addDays(todayDate, FUTURE_HOME_RANGE_DAYS));
    return {
      fromUtc: startLocal.toISOString(),
      toUtc: endLocal.toISOString(),
    };
  }, [todayDate]);

  const trainerSlotsQuery = useAppQuery({
    queryKey: keys.trainerSlots.mine(dateRange),
    enabled: Boolean(me),
    queryFn: ({ signal }) => getMyTrainerSlots(dateRange, { signal }),
    refetchInterval: NOW_REFRESH_INTERVAL_MS,
    refetchIntervalInBackground: false,
  });

  const attendanceRange = useMemo(() => {
    const startLocal = startOfLocalDay(addDays(todayDate, -PAST_ATTENDANCE_RANGE_DAYS));
    const endLocal = endOfLocalDay(addDays(todayDate, FUTURE_HOME_RANGE_DAYS));
    return {
      fromUtc: startLocal.toISOString(),
      toUtc: endLocal.toISOString(),
    };
  }, [todayDate]);

  const attendanceSlotsQuery = useAppQuery({
    queryKey: keys.trainerSlots.mine(attendanceRange),
    enabled: Boolean(me),
    queryFn: ({ signal }) => getMyTrainerSlots(attendanceRange, { signal }),
    refetchInterval: NOW_REFRESH_INTERVAL_MS,
    refetchIntervalInBackground: false,
  });

  useFocusEffect(
    useCallback(() => {
      const nextToday = startOfLocalDay(new Date());
      setTodayDate((prev) => (isSameLocalDay(prev, nextToday) ? prev : nextToday));
      setNowTs(Date.now());
      const intervalId = setInterval(() => {
        setNowTs(Date.now());
      }, NOW_REFRESH_INTERVAL_MS);
      return () => clearInterval(intervalId);
    }, [])
  );

  const sortedTodaySlots = useMemo(() => {
    if (!trainerSlotsQuery.data) {
      return [];
    }
    return trainerSlotsQuery.data
      .filter((slot) => {
        const startTs = getSlotStartTimestamp(slot);
        if (startTs === null) {
          return false;
        }
        return isSameLocalDay(new Date(startTs), todayDate);
      })
      .slice()
      .sort(sortByStart);
  }, [trainerSlotsQuery.data, todayDate]);

  const activeBookedSlots = useMemo(() => {
    const slots = trainerSlotsQuery.data ?? [];
    return slots
      .slice()
      .sort(sortByStart)
      .filter((slot) => {
      const status = getUiSlotStatus(slot, nowTs);
      return status === 'booked' || status === 'needs_attention';
      });
  }, [trainerSlotsQuery.data, nowTs]);

  const currentSlot = useMemo(() =>
    activeBookedSlots.find((slot) => {
      const times = getSlotTimes(slot);
      if (!times) {
        return false;
      }
      const startTs = times.start.getTime();
      const endTs = times.end.getTime();
      return nowTs >= startTs && nowTs < endTs;
    }), [activeBookedSlots, nowTs]
  );

  const nextSlot = useMemo(() =>
    activeBookedSlots.find((slot) => {
      const startTs = getSlotStartTimestamp(slot);
      if (startTs === null) {
        return false;
      }
      return startTs > nowTs;
    }), [activeBookedSlots, nowTs]
  );

  const summary = useMemo(() => {
    let booked = 0;
    let available = 0;
    sortedTodaySlots.forEach((slot) => {
      const status = getUiSlotStatus(slot, nowTs);
      if (status === 'booked' || status === 'needs_attention') {
        booked += 1;
      }
      if (status === 'available' && !isFreeSlotPast(slot, nowTs)) {
        available += 1;
      }
    });
    return {
      booked,
      available,
      hasSlots: booked + available > 0,
    };
  }, [sortedTodaySlots, nowTs]);

  const alerts = useMemo(() => {
    if (!activeBookedSlots.length) {
      return [] as string[];
    }
    const entries: string[] = [];
    if (activeBookedSlots.some((slot) => canMarkNoShow(slot, nowTs))) {
      entries.push(t('home.trainer.alertNoShow'));
    }
    const upcomingSoonMinutes = activeBookedSlots
      .map((slot) => {
        const startTs = getSlotStartTimestamp(slot);
        if (startTs === null) {
          return null;
        }
        const diff = startTs - nowTs;
        if (diff <= 0 || diff > UPCOMING_ALERT_WINDOW_MS) {
          return null;
        }
        return getRoundedMinutesUntil(startTs, nowTs);
      })
      .filter((value): value is number => typeof value === 'number')
      .sort((left, right) => left - right)[0];

    if (typeof upcomingSoonMinutes === 'number' && upcomingSoonMinutes > 0) {
      entries.push(t('home.trainer.alertUpcoming', { minutes: upcomingSoonMinutes }));
    }

    return entries;
  }, [activeBookedSlots, nowTs]);

  const attendanceCount = useMemo(() => {
    const slots = attendanceSlotsQuery.data ?? [];
    return slots.filter((slot) => getUiSlotStatus(slot, nowTs) === 'needs_attention').length;
  }, [attendanceSlotsQuery.data, nowTs]);

  const attendanceSubtitle = attendanceCount > 0
    ? t('home.trainer.attendanceCard.count', { count: attendanceCount })
    : t('home.trainer.attendanceCard.empty');

  const highlightSlot = currentSlot ?? nextSlot ?? null;
  const highlightTimes = highlightSlot ? getSlotTimes(highlightSlot) : null;
  const highlightTimeLabel = highlightTimes
    ? formatTimeRangeRu(highlightTimes.start, highlightTimes.end)
    : t('common.empty');
  const highlightSlotType = (highlightSlot?.slotType ?? '').toLowerCase().trim();
  const highlightIsGroup = highlightSlotType === 'group';
  const highlightClientName = highlightSlot ? getClientName(highlightSlot) : null;
  const highlightTitleLabel = highlightIsGroup
    ? t('bookings.trainingTypeGroup')
    : t('bookings.trainingTypeIndividual');
  const highlightDetailLabel = highlightIsGroup
    ? typeof highlightSlot?.capacityMax === 'number' && highlightSlot.capacityMax > 0
      ? t('home.trainer.groupClients', {
        occupied: highlightSlot.occupiedCount ?? 0,
        capacity: highlightSlot.capacityMax,
      })
      : t('home.trainer.groupClientsOpen', {
        occupied: highlightSlot?.occupiedCount ?? 0,
      })
    : highlightClientName;
  const highlightAvatarUrl = highlightSlot ? getClientAvatarUrl(highlightSlot) : null;
  const highlightAvatarSource = useAuthorizedImageSource(
    highlightIsGroup ? null : highlightAvatarUrl
  );
  const profileAvatarSource = useAuthorizedImageSource(me?.avatarUrl ?? null);

  const updateSlotsCache = useCallback((slotId: string, updater: (slot: SlotDto) => SlotDto) => {
    queryClient.setQueriesData<SlotDto[]>(
      { queryKey: keys.trainerSlots.mine() },
      (current) => {
        if (!current) {
          return current;
        }
        let changed = false;
        const next = current.map((slot) => {
          if (slot.id !== slotId) {
            return slot;
          }
          changed = true;
          return updater(slot);
        });
        return changed ? next : current;
      }
    );
  }, [queryClient]);

  const rollbackSlotsCache = useCallback((snapshot: Array<[QueryKey, SlotDto[] | undefined]>) => {
    snapshot.forEach(([key, data]) => {
      queryClient.setQueryData(key, data);
    });
  }, [queryClient]);

  type SlotsSnapshot = Array<[QueryKey, SlotDto[] | undefined]>;

  type CloseBookingVariables = {
    slotId: string;
    bookingId: string;
    attendance: 'Completed' | 'NoShow';
    markPaid: boolean;
    method: PaymentMethod | null;
  };

  const closeBookingMutation = useAppMutation<unknown, unknown, CloseBookingVariables, { snapshot: SlotsSnapshot }>({
    mutationFn: ({ bookingId, attendance, markPaid, method }: CloseBookingVariables) =>
      closeTrainerBooking(bookingId, attendance, { markPaid, method }),
    onMutate: async ({ slotId, attendance }) => {
      await queryClient.cancelQueries({ queryKey: keys.trainerSlots.mine() });
      const snapshot = queryClient.getQueriesData<SlotDto[]>({ queryKey: keys.trainerSlots.mine() });
      updateSlotsCache(slotId, (slot) => ({
        ...slot,
        bookingStatus: attendance,
      }));
      return { snapshot };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.trainerSlots.mine() });
      queryClient.invalidateQueries({ queryKey: keys.home.upcoming('Trainer') });
      queryClient.invalidateQueries({ queryKey: keys.payments.all() });
      setSheetOpen(false);
      setActiveSlot(null);
    },
    onError: (error, _variables, context) => {
      if (context?.snapshot) {
        rollbackSlotsCache(context.snapshot);
      }
      const presented = presentApiError(error);
      const message = presented.kind === 'conflict'
        ? t('schedule.close.errorConflict')
        : presented.kind === 'notFound'
          ? t('schedule.close.errorNotFound')
          : presented.kind === 'network' || presented.kind === 'timeout'
            ? t('schedule.errorNetwork')
            : presented.message;
      if (shouldShowErrorToast(presented)) {
        showToast({
          type: 'error',
          title: presented.title,
          message,
        });
      }
    },
  });

  const onRefresh = useCallback(async () => {
    setIsManualRefreshing(true);
    try {
      await Promise.allSettled([
        Promise.resolve(refetchMe()),
        trainerSlotsQuery.refetch(),
        attendanceSlotsQuery.refetch(),
      ]);
    } finally {
      setIsManualRefreshing(false);
    }
  }, [attendanceSlotsQuery, refetchMe, trainerSlotsQuery]);

  const isRefreshing = useMemo(() =>
    isManualRefreshing
    && (isMeFetching || trainerSlotsQuery.isFetching || attendanceSlotsQuery.isFetching),
  [attendanceSlotsQuery.isFetching, isManualRefreshing, isMeFetching, trainerSlotsQuery.isFetching]);

  const handleOpenActions = (slot: SlotDto) => {
    if (!slot.id || !slot.bookingId || closeBookingMutation.isPending) {
      return;
    }
    setActiveSlot(slot);
    setSheetOpen(true);
  };

  const handleCreateSlot = () => {
    navigation.navigate('CreateSlot', {
      initialDateIsoLocal: todayDate.toISOString(),
    });
  };

  const showSummary = !isMeLoading
    && !trainerSlotsQuery.isLoading
    && !meError
    && !trainerSlotsQuery.error;
  const summaryLabel = showSummary
    ? summary.hasSlots
      ? t('home.trainer.summary', {
        booked: summary.booked,
        available: summary.available,
      })
      : t('home.trainer.summaryEmpty')
    : null;

  return (
    <YStack flex={1} backgroundColor="$backgroundSoft">
      <TabScrollView
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
          />
        }
        contentContainerStyle={{
          padding: 24,
        }}
        extraBottom={96}
      >
        <YStack gap="$4">
          <TrainerHomeHeader profileAvatarSource={profileAvatarSource} />
          <TrainerNowNextCard
            isLoading={isMeLoading || trainerSlotsQuery.isLoading}
            hasError={Boolean(meError || trainerSlotsQuery.error)}
            highlightSlot={highlightSlot ?? null}
            currentSlot={currentSlot ?? null}
            highlightTimeLabel={highlightTimeLabel}
            highlightTitleLabel={highlightTitleLabel}
            highlightDetailLabel={highlightDetailLabel}
            isGroupTraining={highlightIsGroup}
            highlightAvatarSource={highlightAvatarSource}
            nowTs={nowTs}
            showAttendanceActions={attendanceActionsAvailable}
            onRetry={onRefresh}
            onOpenActions={handleOpenActions}
            onGoToSchedule={() => {
              const initialDateIsoLocal = highlightSlot?.startsAtUtc
                ? toStartOfLocalDayIso(highlightSlot.startsAtUtc)
                : null;

              navigation.navigate('Schedule', {
                screen: 'ScheduleHome',
                params: initialDateIsoLocal
                  ? { initialDateIsoLocal }
                  : undefined,
              });
            }}
          />
          {summaryLabel ? (
            <Text fontSize="$4" fontWeight="600" color="$text">
              {summaryLabel}
            </Text>
          ) : null}
          <TrainerAttendanceQueueCard
            title={t('home.trainer.attendanceCard.title')}
            subtitle={attendanceSubtitle}
            count={attendanceCount}
            onPress={() => navigation.navigate('Schedule', { screen: 'AttendanceQueue' })}
          />
          <TrainerHomeAlertsCard alerts={alerts} />
        </YStack>
      </TabScrollView>
      <SlotActionsSheet
        open={sheetOpen}
        slot={activeSlot}
        nowTs={nowTs}
        onOpenChange={(open) => {
          if (!open) {
            setSheetOpen(false);
            setActiveSlot(null);
            return;
          }
          setSheetOpen(open);
        }}
        onMarkCompleted={undefined}
        onMarkNoShow={undefined}
        onCloseBooking={({ slot, attendance, markPaid, method }) => {
          if (!slot.id || !slot.bookingId || closeBookingMutation.isPending) {
            return;
          }
          if (attendance === 'Completed' && !canMarkCompleted(slot, nowTs)) {
            return;
          }
          if (attendance === 'NoShow' && !canMarkNoShow(slot, nowTs)) {
            return;
          }
          closeBookingMutation.mutate({
            slotId: slot.id,
            bookingId: slot.bookingId,
            attendance,
            markPaid,
            method,
          });
        }}
        isCancelling={false}
        isMarkingCompleted={false}
        isMarkingNoShow={false}
        isClosingBooking={closeBookingMutation.isPending}
        showAttendanceActions={attendanceActionsAvailable}
      />
      <Button
        position="absolute"
        left="$6"
        right="$6"
        bottom={tabBarHeight + 16}
        minHeight="$11"
        backgroundColor="$accent"
        color="$accentText"
        borderRadius="$6"
        onPress={handleCreateSlot}
      >
        <XStack alignItems="center" gap="$2">
          <AppIcon name="plus" size={20} color="$accentText" />
          <Text fontSize="$4" fontWeight="700" color="$accentText">
            {t('schedule.createCta')}
          </Text>
        </XStack>
      </Button>
    </YStack>
  );
}



