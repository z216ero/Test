import { useFocusEffect } from '@react-navigation/native';
import { type QueryKey, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { Alert, RefreshControl } from 'react-native';
import { Button, Text, XStack, YStack } from 'tamagui';
import {
  attendanceActionsAvailable,
  getMyTrainerSlots,
  markSlotCompleted,
  markSlotNoShow,
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
import { TrainerHomeHeader } from './trainer-home/ui/TrainerHomeHeader';
import { TrainerNowNextCard } from './trainer-home/ui/TrainerNowNextCard';

const NOW_REFRESH_INTERVAL_MS = 30 * 1000;
const UPCOMING_ALERT_WINDOW_MS = 30 * 60 * 1000;
const FUTURE_HOME_RANGE_DAYS = 14;

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
    const upcomingSoon = activeBookedSlots.find((slot) => {
      const startTs = getSlotStartTimestamp(slot);
      if (startTs === null) {
        return false;
      }
      const diff = startTs - nowTs;
      return diff > 0 && diff <= UPCOMING_ALERT_WINDOW_MS;
    });
    if (upcomingSoon) {
      entries.push(t('home.trainer.alertUpcoming'));
    }
    return entries;
  }, [activeBookedSlots, nowTs]);

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

  const completeMutation = useAppMutation<unknown, unknown, string, { snapshot: SlotsSnapshot }>({
    mutationFn: (slotId: string) => markSlotCompleted(slotId),
    onMutate: async (slotId) => {
      await queryClient.cancelQueries({ queryKey: keys.trainerSlots.mine() });
      const snapshot = queryClient.getQueriesData<SlotDto[]>({ queryKey: keys.trainerSlots.mine() });
      updateSlotsCache(slotId, (slot) => ({
        ...slot,
        bookingStatus: 'Completed',
      }));
      return { snapshot };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.trainerSlots.mine() });
    },
    onError: (error, _variables, context) => {
      if (context?.snapshot) {
        rollbackSlotsCache(context.snapshot);
      }
      const presented = presentApiError(error);
      if (shouldShowErrorToast(presented)) {
        showToast({
          type: 'error',
          title: presented.title,
          message: presented.message,
        });
      }
    },
  });

  const noShowMutation = useAppMutation<unknown, unknown, string, { snapshot: SlotsSnapshot }>({
    mutationFn: (slotId: string) => markSlotNoShow(slotId),
    onMutate: async (slotId) => {
      await queryClient.cancelQueries({ queryKey: keys.trainerSlots.mine() });
      const snapshot = queryClient.getQueriesData<SlotDto[]>({ queryKey: keys.trainerSlots.mine() });
      updateSlotsCache(slotId, (slot) => ({
        ...slot,
        bookingStatus: 'NoShow',
      }));
      return { snapshot };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.trainerSlots.mine() });
    },
    onError: (error, _variables, context) => {
      if (context?.snapshot) {
        rollbackSlotsCache(context.snapshot);
      }
      const presented = presentApiError(error);
      if (shouldShowErrorToast(presented)) {
        showToast({
          type: 'error',
          title: presented.title,
          message: presented.message,
        });
      }
    },
  });

  const onRefresh = useCallback(() => {
    refetchMe();
    trainerSlotsQuery.refetch();
  }, [refetchMe, trainerSlotsQuery]);

  const isRefreshing = useMemo(() =>
    isMeFetching || trainerSlotsQuery.isFetching,
  [isMeFetching, trainerSlotsQuery.isFetching]);

  const handleMarkCompleted = (slot: SlotDto) => {
    if (!slot.id || completeMutation.isPending) {
      return;
    }
    if (!canMarkCompleted(slot, nowTs)) {
      return;
    }
    completeMutation.mutate(slot.id);
  };

  const handleMarkNoShow = (slot: SlotDto) => {
    if (!slot.id || noShowMutation.isPending) {
      return;
    }
    if (!canMarkNoShow(slot, nowTs)) {
      return;
    }
    Alert.alert(
      t('schedule.actions.noShowConfirmTitle'),
      t('schedule.actions.noShowConfirmMessage'),
      [
        { text: t('profile.personal.cancel'), style: 'cancel' },
        {
          text: t('schedule.actions.noShowConfirm'),
          style: 'destructive',
          onPress: () => noShowMutation.mutate(slot.id as string),
        },
      ]
    );
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
            onMarkCompleted={handleMarkCompleted}
            onMarkNoShow={handleMarkNoShow}
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
          <TrainerHomeAlertsCard alerts={alerts} />
        </YStack>
      </TabScrollView>
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



