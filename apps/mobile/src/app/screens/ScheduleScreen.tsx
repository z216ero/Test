import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, RefreshControl } from 'react-native';
import { Button, Text, XStack, YStack } from 'tamagui';
import {
  attendanceActionsAvailable,
  cancelTrainerSlot,
  getMyTrainerSlots,
  markSlotCompleted,
  markSlotNoShow,
} from '@api/trainerSlotsApi';
import { presentApiError } from '@api/ApiErrorPresenter';
import type { SlotDto } from '@generated/api';
import { t } from '@i18n';
import { useAppMutation, useAppQuery } from '@query/hooks';
import { keys } from '@query/keys';
import { useToast } from '@ui/feedback/useToast';
import { useTabBarPadding } from '@ui/layout/useTabBarPadding';
import { TabScrollView } from '@ui/layout/TabScrollView';
import { AppIcon } from '@ui/AppIcon';
import { EmptyState } from '@ui/states/EmptyState';
import { ErrorState } from '@ui/states/ErrorState';
import type { ScheduleStackParamList } from '@app/navigation/types';
import { DateStrip } from '@app/components/schedule/DateStrip';
import { SlotActionsSheet } from '@app/components/schedule/SlotActionsSheet';
import { SlotCard } from '@app/components/schedule/SlotCard';
import {
  canMarkNoShow,
  canMarkCompleted,
  isActiveSlotForMainList,
  isAttendanceFinalStatus,
  CANCEL_FORBIDDEN_WITHIN_MS,
  getUiSlotStatus,
  shouldShowInCompletedToday,
} from '@app/components/schedule/slotHelpers';
import { type QueryKey, useQueryClient } from '@tanstack/react-query';

const DATE_RANGE_DAYS = 14;
const NOW_REFRESH_INTERVAL_MS = 30 * 1000;

const startOfLocalDay = (value: Date) =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0);

const addDays = (value: Date, days: number) => {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
};

const isSameLocalDay = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear()
  && left.getMonth() === right.getMonth()
  && left.getDate() === right.getDate();

const buildDateKey = (value: Date): string => {
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${value.getFullYear()}-${month}-${day}`;
};

const sortByStart = (a: SlotDto, b: SlotDto) => {
  const aTime = a.startsAtUtc ? new Date(a.startsAtUtc).getTime() : 0;
  const bTime = b.startsAtUtc ? new Date(b.startsAtUtc).getTime() : 0;
  return aTime - bTime;
};

type Props = NativeStackScreenProps<ScheduleStackParamList, 'ScheduleHome'>;

type CompletedSectionProps = {
  open: boolean;
  count: number;
  slots: SlotDto[];
  nowTs: number;
  onToggle: () => void;
};

const ScheduleSkeleton = () => (
  <YStack gap="$4">
    {Array.from({ length: 3 }).map((_, index) => (
      <YStack
        key={`skeleton-${index}`}
        gap="$3"
        padding="$4"
        backgroundColor="$background"
        borderRadius="$5"
        borderWidth={1}
        borderColor="$border"
      >
        <YStack height={16} width="60%" backgroundColor="$surfaceMuted" borderRadius="$3" />
        <YStack height={12} width="40%" backgroundColor="$surfaceMuted" borderRadius="$3" />
        <XStack gap="$3" alignItems="center">
          <YStack width="$10" height="$10" borderRadius="$6" backgroundColor="$surfaceMuted" />
          <YStack gap="$2" flex={1}>
            <YStack height={14} width="70%" backgroundColor="$surfaceMuted" borderRadius="$3" />
            <YStack height={12} width="50%" backgroundColor="$surfaceMuted" borderRadius="$3" />
          </YStack>
        </XStack>
      </YStack>
    ))}
  </YStack>
);

const CompletedTodaySection = ({
  open,
  count,
  slots,
  nowTs,
  onToggle,
}: CompletedSectionProps) => {
  if (count === 0) {
    return null;
  }

  return (
    <YStack gap="$3">
      <Button
        unstyled
        backgroundColor="$surfaceMuted"
        borderWidth={1}
        borderColor="$border"
        borderRadius="$4"
        padding="$3"
        onPress={onToggle}
      >
        <XStack alignItems="center" justifyContent="space-between">
          <Text fontSize="$3" fontWeight="600" color="$text">
            {t('schedule.completedTodayTitle', { count })}
          </Text>
          <YStack
            style={{
              transform: [{ rotate: open ? '90deg' : '0deg' }],
            }}
          >
            <AppIcon name="chevronRight" size={18} color="$muted" />
          </YStack>
        </XStack>
      </Button>
      {open ? (
        <YStack gap="$3">
          {slots.map((slot) => (
            <SlotCard
              key={slot.id ?? `${slot.startsAtUtc ?? 'slot'}`}
              slot={slot}
              nowTs={nowTs}
              onPress={undefined}
              variant="muted"
            />
          ))}
        </YStack>
      ) : null}
    </YStack>
  );
};

export function ScheduleScreen({ navigation }: Props) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { contentBottomPadding } = useTabBarPadding();

  const [selectedDate, setSelectedDate] = useState(() => startOfLocalDay(new Date()));
  const [todayDate, setTodayDate] = useState(() => startOfLocalDay(new Date()));
  const [tomorrowDate, setTomorrowDate] = useState(() => addDays(startOfLocalDay(new Date()), 1));
  const [pickerVisible, setPickerVisible] = useState(false);
  const [slotMarkers, setSlotMarkers] = useState<Record<string, boolean>>({});
  const [activeSlot, setActiveSlot] = useState<SlotDto | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [completedExpanded, setCompletedExpanded] = useState(false);
  const todayRef = useRef(todayDate);

  useEffect(() => {
    todayRef.current = todayDate;
  }, [todayDate]);

  const dateRange = useMemo(() => {
    const dayStart = startOfLocalDay(selectedDate);
    const dayEnd = new Date(
      dayStart.getFullYear(),
      dayStart.getMonth(),
      dayStart.getDate(),
      23,
      59,
      59,
      999
    );
    return {
      fromUtc: dayStart.toISOString(),
      toUtc: dayEnd.toISOString(),
    };
  }, [selectedDate]);

  const {
    data: slots = [],
    isLoading,
    isFetching,
    isStale,
    error,
    refetch,
  } = useAppQuery({
    queryKey: keys.trainerSlots.mine(dateRange),
    queryFn: async ({ signal }) => {
      const data = await getMyTrainerSlots(dateRange, { signal });
      return data.slice().sort(sortByStart);
    },
  });

  useFocusEffect(
    useCallback(() => {
      const nextToday = startOfLocalDay(new Date());
      const nextTomorrow = addDays(nextToday, 1);
      setTodayDate((prev) => (isSameLocalDay(prev, nextToday) ? prev : nextToday));
      setTomorrowDate((prev) => (isSameLocalDay(prev, nextTomorrow) ? prev : nextTomorrow));
      setSelectedDate((current) =>
        isSameLocalDay(current, todayRef.current) ? nextToday : current
      );
      if (!isLoading && isStale) {
        refetch();
      }
    }, [isLoading, isStale, refetch])
  );

  useFocusEffect(
    useCallback(() => {
      setNowTs(Date.now());
      const intervalId = setInterval(() => {
        setNowTs(Date.now());
      }, NOW_REFRESH_INTERVAL_MS);
      return () => clearInterval(intervalId);
    }, [])
  );

  const selectedKey = buildDateKey(selectedDate);

  useEffect(() => {
    if (!isLoading && !error) {
      setSlotMarkers((prev) => ({
        ...prev,
        [selectedKey]: slots.length > 0,
      }));
    }
  }, [slots.length, isLoading, error, selectedKey]);

  useEffect(() => {
    setCompletedExpanded(false);
  }, [selectedKey]);

  const visibleDates = useMemo(() =>
    Array.from({ length: DATE_RANGE_DAYS }).map((_, index) =>
      addDays(todayDate, index)
    ), [todayDate]
  );

  const maxDate = useMemo(() => addDays(todayDate, DATE_RANGE_DAYS - 1), [todayDate]);

  const sortedSlots = useMemo(() => slots.slice().sort(sortByStart), [slots]);

  const activeSlots = useMemo(
    () => sortedSlots.filter((slot) => isActiveSlotForMainList(slot, nowTs)),
    [sortedSlots, nowTs]
  );

  const isSelectedToday = isSameLocalDay(selectedDate, todayDate);

  const completedTodaySlots = useMemo(() => {
    if (!isSelectedToday) {
      return [];
    }
    return sortedSlots.filter((slot) => shouldShowInCompletedToday(slot));
  }, [sortedSlots, isSelectedToday]);

  const counts = useMemo(() => {
    let available = 0;
    let booked = 0;
    activeSlots.forEach((slot) => {
      const status = getUiSlotStatus(slot, nowTs);
      if (status === 'available') {
        available += 1;
        return;
      }
      if (status === 'booked' || status === 'needs_attention') {
        booked += 1;
      }
    });

    return {
      available,
      booked,
      active: available + booked,
    };
  }, [activeSlots, nowTs]);

  const summaryLabel = counts.active
    ? isSelectedToday
      ? t('schedule.summaryToday', {
        total: counts.active,
        available: counts.available,
      })
      : t('schedule.summary', {
        total: counts.active,
        available: counts.available,
      })
    : null;

  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsManualRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsManualRefreshing(false);
    }
  };

  const handleSelectDate = (value: Date) => {
    setSelectedDate(startOfLocalDay(value));
  };

  const handleDateChange = (event: DateTimePickerEvent, date?: Date) => {
    if (event.type === 'dismissed' && Platform.OS === 'android') {
      return;
    }
    if (date) {
      handleSelectDate(date);
    }
  };

  const openDatePicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: selectedDate,
        mode: 'date',
        minimumDate: todayDate,
        maximumDate: maxDate,
        onChange: handleDateChange,
      });
      return;
    }
    setPickerVisible(true);
  };

  const handleCreateSlot = () => {
    navigation.getParent()?.navigate('CreateSlot', {
      initialDateIsoLocal: selectedDate.toISOString(),
    });
  };

  const openSlot = (slot: SlotDto) => {
    if (!slot.id) {
      return;
    }
    setActiveSlot(slot);
    setSheetOpen(true);
  };

  const closeSheet = () => {
    setSheetOpen(false);
    setActiveSlot(null);
  };

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
  type SlotsContext = { snapshot: SlotsSnapshot; activeSlot?: SlotDto | null };

  const cancelMutation = useAppMutation<SlotDto, unknown, string, SlotsContext>({
    mutationFn: (slotId: string) => cancelTrainerSlot(slotId),
    onMutate: async (slotId) => {
      await queryClient.cancelQueries({ queryKey: keys.trainerSlots.mine() });
      const snapshot = queryClient.getQueriesData<SlotDto[]>({ queryKey: keys.trainerSlots.mine() });
      const activeSlotSnapshot = activeSlot;
      updateSlotsCache(slotId, (slot) => ({
        ...slot,
        status: 'Cancelled',
        bookingStatus: 'Cancelled',
      }));
      setActiveSlot((current) =>
        current && current.id === slotId
          ? { ...current, status: 'Cancelled', bookingStatus: 'Cancelled' }
          : current
      );
      return { snapshot, activeSlot: activeSlotSnapshot };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.trainerSlots.mine() });
      queryClient.invalidateQueries({ queryKey: keys.home.upcoming('Trainer') });
      refetch();
      showToast({ type: 'success', title: t('schedule.toast.cancelled') });
      closeSheet();
    },
    onError: (err, _variables, context) => {
      if (context?.snapshot) {
        rollbackSlotsCache(context.snapshot);
      }
      if (context?.activeSlot) {
        setActiveSlot(context.activeSlot);
      }
      const presented = presentApiError(err);
      const message =
        presented.kind === 'conflict' || presented.kind === 'notFound'
          ? t('schedule.errorChanged')
          : presented.kind === 'network' || presented.kind === 'timeout'
            ? t('schedule.errorNetwork')
            : presented.message;
      showToast({
        type: 'error',
        title: presented.title,
        message,
      });
    },
  });

  const completeMutation = useAppMutation<unknown, unknown, string, SlotsContext>({
    mutationFn: (slotId: string) => markSlotCompleted(slotId),
    onMutate: async (slotId) => {
      await queryClient.cancelQueries({ queryKey: keys.trainerSlots.mine() });
      const snapshot = queryClient.getQueriesData<SlotDto[]>({ queryKey: keys.trainerSlots.mine() });
      const activeSlotSnapshot = activeSlot;
      updateSlotsCache(slotId, (slot) => ({
        ...slot,
        bookingStatus: 'Completed',
      }));
      setActiveSlot((current) =>
        current && current.id === slotId
          ? { ...current, bookingStatus: 'Completed' }
          : current
      );
      return { snapshot, activeSlot: activeSlotSnapshot };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.trainerSlots.mine() });
      queryClient.invalidateQueries({ queryKey: keys.home.upcoming('Trainer') });
      refetch();
      showToast({ type: 'success', title: t('status.completed') });
      closeSheet();
    },
    onError: (err, _variables, context) => {
      if (context?.snapshot) {
        rollbackSlotsCache(context.snapshot);
      }
      if (context?.activeSlot) {
        setActiveSlot(context.activeSlot);
      }
      const presented = presentApiError(err);
      showToast({
        type: 'error',
        title: presented.title,
        message: presented.message,
      });
    },
  });

  const noShowMutation = useAppMutation<unknown, unknown, string, SlotsContext>({
    mutationFn: (slotId: string) => markSlotNoShow(slotId),
    onMutate: async (slotId) => {
      await queryClient.cancelQueries({ queryKey: keys.trainerSlots.mine() });
      const snapshot = queryClient.getQueriesData<SlotDto[]>({ queryKey: keys.trainerSlots.mine() });
      const activeSlotSnapshot = activeSlot;
      updateSlotsCache(slotId, (slot) => ({
        ...slot,
        bookingStatus: 'NoShow',
      }));
      setActiveSlot((current) =>
        current && current.id === slotId
          ? { ...current, bookingStatus: 'NoShow' }
          : current
      );
      return { snapshot, activeSlot: activeSlotSnapshot };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.trainerSlots.mine() });
      queryClient.invalidateQueries({ queryKey: keys.home.upcoming('Trainer') });
      refetch();
      showToast({ type: 'success', title: t('status.noShow') });
      closeSheet();
    },
    onError: (err, _variables, context) => {
      if (context?.snapshot) {
        rollbackSlotsCache(context.snapshot);
      }
      if (context?.activeSlot) {
        setActiveSlot(context.activeSlot);
      }
      const presented = presentApiError(err);
      showToast({
        type: 'error',
        title: presented.title,
        message: presented.message,
      });
    },
  });

  const confirmCancelSlot = (slot: SlotDto) => {
    if (!slot.id || cancelMutation.isPending) {
      return;
    }

    const startTs = slot.startsAtUtc ? new Date(slot.startsAtUtc).getTime() : null;
    const hasValidStart = startTs !== null && !Number.isNaN(startTs);
    const statusRaw = slot.status?.toLowerCase().trim();
    const isBooked = statusRaw === 'booked';
    const isFinalAttendance = isAttendanceFinalStatus(slot);
    const isWithinThirtyMinutes = hasValidStart && nowTs >= startTs - CANCEL_FORBIDDEN_WITHIN_MS;

    const title = isBooked
      ? isWithinThirtyMinutes
        ? t('schedule.actions.cancelTrainingConfirmSoonTitle')
        : t('schedule.actions.cancelTrainingConfirmTitle')
      : t('schedule.actions.cancelSlotConfirmTitle');
    const message = isBooked
      ? isWithinThirtyMinutes
        ? t('schedule.actions.cancelTrainingConfirmSoonMessage')
        : t('schedule.actions.cancelTrainingConfirmMessage')
      : t('schedule.actions.cancelSlotConfirmMessage');

    if (isBooked && isFinalAttendance) {
      return;
    }

    Alert.alert(
      title,
      message,
      [
        { text: t('profile.personal.cancel'), style: 'cancel' },
        {
          text: isBooked
            ? t('schedule.actions.cancelTrainingConfirm')
            : t('schedule.actions.cancelSlotConfirm'),
          style: 'destructive',
          onPress: () => cancelMutation.mutate(slot.id as string),
        },
      ]
    );
  };

  const renderContent = () => {
    if (isLoading) {
      return <ScheduleSkeleton />;
    }

    if (error) {
      return <ErrorState error={error} onRetry={refetch} />;
    }

    if (sortedSlots.length === 0) {
      return (
        <EmptyState
          title={t('schedule.emptyDay')}
          ctaLabel={t('schedule.createCta')}
          onCtaPress={handleCreateSlot}
        />
      );
    }

    return (
      <YStack gap="$4">
        {activeSlots.map((slot) => (
          <SlotCard
            key={slot.id ?? `${slot.startsAtUtc ?? 'slot'}`}
            slot={slot}
            nowTs={nowTs}
            onPress={slot.id ? () => openSlot(slot) : undefined}
          />
        ))}
        {isSelectedToday ? (
          <CompletedTodaySection
            open={completedExpanded}
            count={completedTodaySlots.length}
            slots={completedTodaySlots}
            nowTs={nowTs}
            onToggle={() => setCompletedExpanded((prev) => !prev)}
          />
        ) : null}
      </YStack>
    );
  };

  return (
    <YStack flex={1} backgroundColor="$backgroundSoft">
      <TabScrollView
        refreshControl={
          <RefreshControl
            refreshing={isManualRefreshing && isFetching}
            onRefresh={handleRefresh}
          />
        }
        contentContainerStyle={{
          padding: 24,
        }}
        extraBottom={72}
      >
        <YStack gap="$4">
          {/* Заголовок экрана */}
          <Text fontSize="$8" fontWeight="700" color="$text">
            {t('schedule.title')}
          </Text>
          {/* Лента дат и календарь */}
          <DateStrip
            dates={visibleDates}
            selectedDate={selectedDate}
            todayDate={todayDate}
            tomorrowDate={tomorrowDate}
            markers={slotMarkers}
            onSelectDate={handleSelectDate}
            onOpenCalendar={openDatePicker}
          />
          {/* iOS-пикер даты */}
          {pickerVisible && Platform.OS === 'ios' ? (
            <YStack
              padding="$4"
              borderWidth={1}
              borderColor="$border"
              borderRadius="$4"
              backgroundColor="$background"
              gap="$3"
            >
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display="inline"
                minimumDate={todayDate}
                maximumDate={maxDate}
                onChange={handleDateChange}
              />
              <Button
                backgroundColor="$surfaceMuted"
                borderWidth={1}
                borderColor="$border"
                onPress={() => setPickerVisible(false)}
              >
                {t('common.close')}
              </Button>
            </YStack>
          ) : null}
          {/* Сводка по дню */}
          {summaryLabel ? (
            <Text fontSize="$4" fontWeight="600" color="$text">
              {summaryLabel}
            </Text>
          ) : null}
          {/* Основной список слотов */}
          {renderContent()}
        </YStack>
      </TabScrollView>
      {/* FAB: создание слота */}
      <Button
        position="absolute"
        right="$6"
        bottom={contentBottomPadding}
        width="$10"
        height="$10"
        borderRadius="$6"
        backgroundColor="$accent"
        elevation={2}
        shadowColor="$border"
        shadowOpacity={0.2}
        shadowRadius={6}
        onPress={handleCreateSlot}
      >
        <AppIcon name="plus" size={22} color="$accentText" />
      </Button>
      {/* Bottom sheet действий со слотом */}
      <SlotActionsSheet
        open={sheetOpen}
        slot={activeSlot}
        nowTs={nowTs}
        onOpenChange={(open) => {
          if (!open) {
            closeSheet();
          } else {
            setSheetOpen(open);
          }
        }}
        onCancelSlot={confirmCancelSlot}
        onMarkCompleted={(slot) => {
          if (!slot.id || completeMutation.isPending) {
            return;
          }
          if (!canMarkCompleted(slot, nowTs)) {
            return;
          }
          completeMutation.mutate(slot.id);
        }}
        onMarkNoShow={(slot) => {
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
        }}
        isCancelling={cancelMutation.isPending}
        isMarkingCompleted={completeMutation.isPending}
        isMarkingNoShow={noShowMutation.isPending}
        showAttendanceActions={attendanceActionsAvailable}
      />
    </YStack>
  );
}



