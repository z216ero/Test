import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, RefreshControl } from 'react-native';
import { Button, Text, YStack } from 'tamagui';
import {
  attendanceActionsAvailable,
  cancelTrainerSlot,
  closeTrainerBooking,
  getMyTrainerSlots,
  type PaymentMethod,
} from '@api/trainerSlotsApi';
import { presentApiError, shouldShowErrorToast } from '@api/ApiErrorPresenter';
import type { SlotDto } from '@generated/api';
import { t } from '@i18n';
import { useAppMutation, useAppQuery } from '@query/hooks';
import { keys } from '@query/keys';
import { IOSDatePickerCard } from '@ui/components';
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
import {
  clearScheduleBadge,
  markSlotHighlightSeen,
  usePushIndicators,
} from '@notifications/pushIndicators';
import { ScheduleCompletedTodaySection } from './schedule/ui/ScheduleCompletedTodaySection';
import { ScheduleSkeleton } from './schedule/ui/ScheduleSkeleton';

const FUTURE_DATE_RANGE_DAYS = 14;
const PAST_DATE_RANGE_DAYS = 14;
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

const resolveInitialSelectedDate = (initialDateIsoLocal?: string): Date => {
  if (!initialDateIsoLocal) {
    return startOfLocalDay(new Date());
  }
  const parsed = new Date(initialDateIsoLocal);
  if (Number.isNaN(parsed.getTime())) {
    return startOfLocalDay(new Date());
  }
  return startOfLocalDay(parsed);
};

export function ScheduleScreen({ navigation, route }: Props) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { contentBottomPadding } = useTabBarPadding();
  const { slotHighlights } = usePushIndicators();
  const initialDateIsoLocal = route.params?.initialDateIsoLocal;

  const [selectedDate, setSelectedDate] = useState(() =>
    resolveInitialSelectedDate(initialDateIsoLocal)
  );
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

  useEffect(() => {
    const nextDate = resolveInitialSelectedDate(initialDateIsoLocal);
    setSelectedDate((current) =>
      isSameLocalDay(current, nextDate) ? current : nextDate
    );
  }, [initialDateIsoLocal]);

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
      clearScheduleBadge().catch(() => {});
    }, [])
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

  const minDate = useMemo(() => addDays(todayDate, -PAST_DATE_RANGE_DAYS), [todayDate]);
  const maxDate = useMemo(() => addDays(todayDate, FUTURE_DATE_RANGE_DAYS), [todayDate]);

  const visibleDates = useMemo(() =>
    Array.from({ length: PAST_DATE_RANGE_DAYS + FUTURE_DATE_RANGE_DAYS + 1 }).map((_, index) =>
      addDays(minDate, index)
    ), [minDate]
  );

  const sortedSlots = useMemo(() => slots.slice().sort(sortByStart), [slots]);

  const activeSlots = useMemo(
    () => sortedSlots.filter((slot) => isActiveSlotForMainList(slot, nowTs)),
    [sortedSlots, nowTs]
  );

  const isSelectedToday = isSameLocalDay(selectedDate, todayDate);
  const isPastDay = selectedDate.getTime() < todayDate.getTime();
  const canCreateSlot = selectedDate.getTime() >= todayDate.getTime();

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
        minimumDate: minDate,
        maximumDate: maxDate,
        onChange: handleDateChange,
      });
      return;
    }
    setPickerVisible(true);
  };

  const handleCreateSlot = () => {
    if (!canCreateSlot) {
      return;
    }
    navigation.getParent()?.navigate('CreateSlot', {
      initialDateIsoLocal: selectedDate.toISOString(),
    });
  };

  const getHighlightForSlot = useCallback((slot: SlotDto) => {
    if (!slot.id) {
      return null;
    }
    const highlight = slotHighlights[slot.id];
    if (!highlight || highlight.seen) {
      return null;
    }
    return { color: highlight.color, chipText: highlight.chipText };
  }, [slotHighlights]);

  const openSlot = (slot: SlotDto) => {
    if (!slot.id) {
      return;
    }
    if ((slot.slotType ?? '').toLowerCase() === 'group') {
      navigation.navigate('SlotDetails', { slot });
      return;
    }
    markSlotHighlightSeen(slot.id).catch(() => {});
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
      queryClient.invalidateQueries({ queryKey: keys.payments.all() });
      refetch();
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
      if (shouldShowErrorToast(presented)) {
        showToast({
          type: 'error',
          title: presented.title,
          message,
        });
      }
    },
  });

  type CloseBookingVariables = {
    slotId: string;
    bookingId: string;
    attendance: 'Completed' | 'NoShow';
    markPaid: boolean;
    method: PaymentMethod | null;
  };

  const closeBookingMutation = useAppMutation<unknown, unknown, CloseBookingVariables, SlotsContext>({
    mutationFn: ({ bookingId, attendance, markPaid, method }: CloseBookingVariables) =>
      closeTrainerBooking(bookingId, attendance, { markPaid, method }),
    onMutate: async ({ slotId, attendance }) => {
      await queryClient.cancelQueries({ queryKey: keys.trainerSlots.mine() });
      const snapshot = queryClient.getQueriesData<SlotDto[]>({ queryKey: keys.trainerSlots.mine() });
      const activeSlotSnapshot = activeSlot;
      updateSlotsCache(slotId, (slot) => ({
        ...slot,
        bookingStatus: attendance,
      }));
      setActiveSlot((current) =>
        current && current.id === slotId
          ? { ...current, bookingStatus: attendance }
          : current
      );
      return { snapshot, activeSlot: activeSlotSnapshot };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.trainerSlots.mine() });
      queryClient.invalidateQueries({ queryKey: keys.home.upcoming('Trainer') });
      refetch();
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

    const visibleSlots = isPastDay
      ? sortedSlots.filter((slot) => getUiSlotStatus(slot, nowTs) !== 'available')
      : activeSlots;
    const showCompletedTodaySection = isSelectedToday && completedTodaySlots.length > 0;

    if (visibleSlots.length === 0) {
      if (showCompletedTodaySection) {
        return (
          <YStack gap="$4">
            <ScheduleCompletedTodaySection
              open={completedExpanded}
              count={completedTodaySlots.length}
              slots={completedTodaySlots}
              nowTs={nowTs}
              onToggle={() => setCompletedExpanded((prev) => !prev)}
              getHighlight={getHighlightForSlot}
            />
          </YStack>
        );
      }

      return (
        <EmptyState
          title={t('schedule.emptyDay')}
          ctaLabel={canCreateSlot ? t('schedule.createCta') : undefined}
          onCtaPress={canCreateSlot ? handleCreateSlot : undefined}
        />
      );
    }

    return (
      <YStack gap="$4">
        {visibleSlots.map((slot) => (
          <SlotCard
            key={slot.id ?? `${slot.startsAtUtc ?? 'slot'}`}
            slot={slot}
            nowTs={nowTs}
            onPress={slot.id ? () => openSlot(slot) : undefined}
            highlight={getHighlightForSlot(slot)}
          />
        ))}
        {showCompletedTodaySection ? (
          <ScheduleCompletedTodaySection
            open={completedExpanded}
            count={completedTodaySlots.length}
            slots={completedTodaySlots}
            nowTs={nowTs}
            onToggle={() => setCompletedExpanded((prev) => !prev)}
            getHighlight={getHighlightForSlot}
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
            <IOSDatePickerCard
              value={selectedDate}
              minimumDate={minDate}
              maximumDate={maxDate}
              onChange={handleDateChange}
              onClose={() => setPickerVisible(false)}
            />
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
      {canCreateSlot ? (
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
      ) : null}
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
        isCancelling={cancelMutation.isPending}
        isMarkingCompleted={false}
        isMarkingNoShow={false}
        isClosingBooking={closeBookingMutation.isPending}
        showAttendanceActions={attendanceActionsAvailable}
      />
    </YStack>
  );
}



