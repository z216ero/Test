import { useFocusEffect } from '@react-navigation/native';
import { type QueryKey, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image, RefreshControl } from 'react-native';
import { Button, Text, XStack, YStack } from 'tamagui';
import {
  attendanceActionsAvailable,
  getMyTrainerSlots,
  markSlotCompleted,
  markSlotNoShow,
} from '@api/trainerSlotsApi';
import { presentApiError } from '@api/ApiErrorPresenter';
import { getAccessToken } from '@auth/tokenStorage';
import type { SlotDto } from '@generated/api';
import { t } from '@i18n';
import { useAppMutation, useAppQuery } from '@query/hooks';
import { keys } from '@query/keys';
import { AppIcon } from '@ui/AppIcon';
import { useToast } from '@ui/feedback/useToast';
import { useTabBarPadding } from '@ui/layout/useTabBarPadding';
import { TabScrollView } from '@ui/layout/TabScrollView';
import { formatTimeRangeRu } from '@utils/datetime';
import { buildAbsoluteUrl } from '@utils/url';
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

const NOW_REFRESH_INTERVAL_MS = 30 * 1000;
const UPCOMING_ALERT_WINDOW_MS = 30 * 60 * 1000;

const startOfLocalDay = (value: Date) =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0);

const endOfLocalDay = (value: Date) =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate(), 23, 59, 59, 999);

const isSameLocalDay = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear()
  && left.getMonth() === right.getMonth()
  && left.getDate() === right.getDate();

const sortByStart = (a: SlotDto, b: SlotDto) => {
  const aTime = getSlotStartTimestamp(a) ?? 0;
  const bTime = getSlotStartTimestamp(b) ?? 0;
  return aTime - bTime;
};

const getInitials = (name?: string | null) => {
  const value = name?.trim();
  if (!value) {
    return t('common.initialsPlaceholder');
  }
  const parts = value.split(' ').filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return value.slice(0, 2).toUpperCase();
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
  const [avatarToken, setAvatarToken] = useState<string | null>(null);

  const dateRange = useMemo(() => {
    const startLocal = startOfLocalDay(todayDate);
    const endLocal = endOfLocalDay(todayDate);
    return {
      fromUtc: startLocal.toISOString(),
      toUtc: endLocal.toISOString(),
    };
  }, [todayDate]);

  const trainerSlotsQuery = useAppQuery({
    queryKey: keys.trainerSlots.mine(dateRange),
    enabled: Boolean(me),
    queryFn: ({ signal }) => getMyTrainerSlots(dateRange, { signal }),
  });

  useEffect(() => {
    let cancelled = false;
    getAccessToken().then((token) => {
      if (!cancelled) {
        setAvatarToken(token);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const activeBookedSlots = useMemo(() =>
    sortedTodaySlots.filter((slot) => {
      const status = getUiSlotStatus(slot, nowTs);
      return status === 'booked' || status === 'needs_attention';
    }), [sortedTodaySlots, nowTs]
  );

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
  const highlightClientName = highlightSlot ? getClientName(highlightSlot) : null;
  const highlightAvatarUrl = highlightSlot ? getClientAvatarUrl(highlightSlot) : null;
  const highlightAvatarAbsolute = highlightAvatarUrl
    ? buildAbsoluteUrl(highlightAvatarUrl)
    : null;
  const profileAvatarUrl = me?.avatarUrl ?? null;
  const profileAvatarAbsolute = profileAvatarUrl
    ? buildAbsoluteUrl(profileAvatarUrl)
    : null;

  const highlightAvatarSource = useMemo(() => {
    if (!highlightAvatarAbsolute || !avatarToken) {
      return null;
    }
    return {
      uri: highlightAvatarAbsolute,
      headers: { Authorization: `Bearer ${avatarToken}` },
    };
  }, [avatarToken, highlightAvatarAbsolute]);

  const profileAvatarSource = useMemo(() => {
    if (!profileAvatarAbsolute || !avatarToken) {
      return null;
    }
    return {
      uri: profileAvatarAbsolute,
      headers: { Authorization: `Bearer ${avatarToken}` },
    };
  }, [avatarToken, profileAvatarAbsolute]);

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
      showToast({ type: 'success', title: t('status.completed') });
    },
    onError: (error, _variables, context) => {
      if (context?.snapshot) {
        rollbackSlotsCache(context.snapshot);
      }
      const presented = presentApiError(error);
      showToast({
        type: 'error',
        title: presented.title,
        message: presented.message,
      });
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
      showToast({ type: 'success', title: t('status.noShow') });
    },
    onError: (error, _variables, context) => {
      if (context?.snapshot) {
        rollbackSlotsCache(context.snapshot);
      }
      const presented = presentApiError(error);
      showToast({
        type: 'error',
        title: presented.title,
        message: presented.message,
      });
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

  const renderTrainerNowNext = () => {
    const isLoading = isMeLoading || trainerSlotsQuery.isLoading;
    const hasError = Boolean(meError || trainerSlotsQuery.error);
    const sectionTitle = t('home.trainer.sectionTitle');

    if (isLoading) {
      return (
        <YStack
          gap="$3"
          padding="$5"
          backgroundColor="$background"
          borderRadius="$6"
          borderWidth={1}
          borderColor="$border"
        >
          <Text fontSize="$4" fontWeight="700" color="$text">
            {sectionTitle}
          </Text>
          <Text fontSize="$3" color="$muted">
            {t('common.loading')}
          </Text>
        </YStack>
      );
    }

    if (hasError) {
      return (
        <YStack
          gap="$3"
          padding="$5"
          backgroundColor="$background"
          borderRadius="$6"
          borderWidth={1}
          borderColor="$border"
        >
          <Text fontSize="$4" fontWeight="700" color="$text">
            {sectionTitle}
          </Text>
          <Text fontSize="$3" color="$muted">
            {t('errors.generic')}
          </Text>
          <Button
            backgroundColor="$accent"
            color="$accentText"
            borderRadius="$4"
            minHeight="$9"
            paddingHorizontal="$4"
            onPress={onRefresh}
          >
            {t('common.retry')}
          </Button>
        </YStack>
      );
    }

    if (!highlightSlot) {
      return (
        <YStack
          gap="$3"
          padding="$5"
          backgroundColor="$background"
          borderRadius="$6"
          borderWidth={1}
          borderColor="$border"
        >
          <Text fontSize="$4" fontWeight="700" color="$text">
            {sectionTitle}
          </Text>
          <Text fontSize="$3" color="$muted">
            {t('home.trainer.noTrainings')}
          </Text>
        </YStack>
      );
    }

    const header = currentSlot
      ? t('home.trainer.nowTitle')
      : t('home.trainer.nextTitle');

    return (
      <YStack
        gap="$3"
        padding="$5"
        backgroundColor="$background"
        borderRadius="$6"
        borderWidth={1}
        borderColor="$border"
        minHeight="200"
      >
        <YStack gap="$1">
          <Text fontSize="$4" fontWeight="700" color="$text">
            {header}
          </Text>
          <Text fontSize="$3" color="$muted">
            {highlightTimeLabel}
          </Text>
        </YStack>
        <XStack gap="$3" alignItems="center">
          <YStack
            width="$10"
            height="$10"
            borderRadius="$6"
            backgroundColor="$surfaceMuted"
            borderWidth={1}
            borderColor="$border"
            alignItems="center"
            justifyContent="center"
            overflow="hidden"
          >
            {highlightAvatarSource ? (
              <Image
                source={highlightAvatarSource}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
              />
            ) : (
              <Text fontSize="$4" color="$muted">
                {getInitials(highlightClientName)}
              </Text>
            )}
          </YStack>
          <YStack gap="$1" flex={1}>
            <Text fontSize="$4" fontWeight="700" color="$text">
              {highlightClientName ?? t('common.empty')}
            </Text>
          </YStack>
        </XStack>
        {currentSlot && attendanceActionsAvailable ? (
          <XStack gap="$3" flexWrap="wrap">
            {canMarkCompleted(currentSlot, nowTs) ? (
              <Button
                flex={1}
                minHeight="$9"
                backgroundColor="$accent"
                color="$accentText"
                borderRadius="$5"
                onPress={() => handleMarkCompleted(currentSlot)}
              >
                {t('slotDetails.markCompleted')}
              </Button>
            ) : null}
            {canMarkNoShow(currentSlot, nowTs) ? (
              <Button
                flex={1}
                minHeight="$9"
                backgroundColor="$surfaceMuted"
                borderRadius="$5"
                borderWidth={1}
                borderColor="$border"
                onPress={() => handleMarkNoShow(currentSlot)}
              >
                {t('slotDetails.markNoShow')}
              </Button>
            ) : null}
          </XStack>
        ) : null}
        {!currentSlot ? (
          <Button
            backgroundColor="$surfaceMuted"
            borderRadius="$5"
            borderWidth={1}
            borderColor="$border"
            minHeight="$9"
            onPress={() => navigation.navigate('Schedule', { screen: 'ScheduleHome' })}
          >
            {t('home.trainer.goToSchedule')}
          </Button>
        ) : null}
      </YStack>
    );
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
          <XStack alignItems="center" justifyContent="space-between">
            <Text fontSize="$8" fontWeight="700" color="$text">
              {t('home.trainer.title')}
            </Text>
            <YStack
              width="$10"
              height="$10"
              borderRadius="$6"
              backgroundColor="$background"
              borderWidth={1}
              borderColor="$border"
              alignItems="center"
              justifyContent="center"
              overflow="hidden"
            >
              {profileAvatarSource ? (
                <Image
                  source={profileAvatarSource}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                />
              ) : (
                <AppIcon name="user" size={20} color="$muted" />
              )}
            </YStack>
          </XStack>
          {renderTrainerNowNext()}
          {summaryLabel ? (
            <Text fontSize="$4" fontWeight="600" color="$text">
              {summaryLabel}
            </Text>
          ) : null}
          {alerts.length > 0 ? (
            <YStack
              gap="$3"
              padding="$4"
              backgroundColor="$background"
              borderRadius="$6"
              borderWidth={1}
              borderColor="$border"
            >
              <XStack alignItems="center" gap="$2">
                <AppIcon name="alertCircle" size={18} color="$muted" />
                <Text fontSize="$4" fontWeight="600" color="$text">
                  {t('home.trainer.alertsTitle')}
                </Text>
              </XStack>
              {alerts.map((item) => (
                <XStack key={item} gap="$2" alignItems="flex-start">
                  <YStack marginTop="$1">
                    <AppIcon name="info" size={16} color="$muted" />
                  </YStack>
                  <Text fontSize="$3" color="$text" flex={1}>
                    {item}
                  </Text>
                </XStack>
              ))}
            </YStack>
          ) : null}
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



