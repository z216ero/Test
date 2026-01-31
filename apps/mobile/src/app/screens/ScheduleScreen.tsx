import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, RefreshControl } from 'react-native';
import { ScrollView } from '@tamagui/scroll-view';
import { Button, Text, YStack } from 'tamagui';
import {
  attendanceActionsAvailable,
  cancelTrainerSlot,
  getMyTrainerSlots,
  markSlotCompleted,
  markSlotNoShow,
} from '../../api/trainerSlotsApi';
import { presentApiError } from '../../api/ApiErrorPresenter';
import type { SlotDto } from '../../generated/api';
import { t } from '../../i18n';
import { useAppMutation, useAppQuery } from '../../query/hooks';
import { keys } from '../../query/keys';
import { useToast } from '../../ui/feedback/useToast';
import { AppIcon } from '../../ui/AppIcon';
import { EmptyState } from '../../ui/states/EmptyState';
import { ErrorState } from '../../ui/states/ErrorState';
import { LoadingState } from '../../ui/states/LoadingState';
import type { ScheduleStackParamList } from '../navigation/types';
import { DateStrip } from '../components/schedule/DateStrip';
import { SlotActionsSheet } from '../components/schedule/SlotActionsSheet';
import { SlotCard } from '../components/schedule/SlotCard';
import { getSlotStatusType } from '../components/schedule/slotHelpers';
import { useQueryClient } from '@tanstack/react-query';

const DATE_RANGE_DAYS = 14;

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

export function ScheduleScreen({ navigation }: Props) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const tabBarHeight = useBottomTabBarHeight();

  const [selectedDate, setSelectedDate] = useState(() => startOfLocalDay(new Date()));
  const [todayDate, setTodayDate] = useState(() => startOfLocalDay(new Date()));
  const [tomorrowDate, setTomorrowDate] = useState(() => addDays(startOfLocalDay(new Date()), 1));
  const [pickerVisible, setPickerVisible] = useState(false);
  const [slotMarkers, setSlotMarkers] = useState<Record<string, boolean>>({});
  const [activeSlot, setActiveSlot] = useState<SlotDto | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
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
      if (!isLoading) {
        refetch();
      }
    }, [isLoading, refetch])
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

  const visibleDates = useMemo(() =>
    Array.from({ length: DATE_RANGE_DAYS }).map((_, index) =>
      addDays(todayDate, index)
    ), [todayDate]
  );

  const maxDate = useMemo(() => addDays(todayDate, DATE_RANGE_DAYS - 1), [todayDate]);

  const sortedSlots = useMemo(() => slots.slice().sort(sortByStart), [slots]);

  const counts = useMemo(() => {
    let available = 0;
    let booked = 0;
    let cancelled = 0;

    sortedSlots.forEach((slot) => {
      const status = getSlotStatusType(slot);
      if (status === 'available') {
        available += 1;
        return;
      }
      if (status === 'booked') {
        booked += 1;
        return;
      }
      cancelled += 1;
    });

    return {
      available,
      booked,
      cancelled,
      active: available + booked,
    };
  }, [sortedSlots]);

  const summaryLabel = counts.active
    ? isSameLocalDay(selectedDate, todayDate)
      ? t('schedule.summaryToday', {
        total: counts.active,
        available: counts.available,
      })
      : t('schedule.summary', {
        total: counts.active,
        available: counts.available,
      })
    : null;

  const handleRefresh = () => {
    refetch();
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
    console.log(slot.id)
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

  const cancelMutation = useAppMutation({
    mutationFn: (slotId: string) => cancelTrainerSlot(slotId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.trainerSlots.mine() });
      queryClient.invalidateQueries({ queryKey: keys.home.upcoming('Trainer') });
      refetch();
      showToast({ type: 'success', title: t('schedule.toast.cancelled') });
      closeSheet();
    },
    onError: (err) => {
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

  const completeMutation = useAppMutation({
    mutationFn: (slotId: string) => markSlotCompleted(slotId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.trainerSlots.mine() });
      queryClient.invalidateQueries({ queryKey: keys.home.upcoming('Trainer') });
      refetch();
      showToast({ type: 'success', title: t('status.completed') });
      closeSheet();
    },
    onError: (err) => {
      const presented = presentApiError(err);
      showToast({
        type: 'error',
        title: presented.title,
        message: presented.message,
      });
    },
  });

  const noShowMutation = useAppMutation({
    mutationFn: (slotId: string) => markSlotNoShow(slotId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.trainerSlots.mine() });
      queryClient.invalidateQueries({ queryKey: keys.home.upcoming('Trainer') });
      refetch();
      showToast({ type: 'success', title: t('status.noShow') });
      closeSheet();
    },
    onError: (err) => {
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

    Alert.alert(
      t('schedule.actions.cancelSlotConfirmTitle'),
      t('schedule.actions.cancelSlotConfirmMessage'),
      [
        { text: t('profile.personal.cancel'), style: 'cancel' },
        {
          text: t('schedule.actions.cancelSlotConfirm'),
          style: 'destructive',
          onPress: () => cancelMutation.mutate(slot.id as string),
        },
      ]
    );
  };

  const renderContent = () => {
    if (isLoading) {
      return <LoadingState />;
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
        {sortedSlots.map((slot) => (
          <SlotCard
            key={slot.id ?? `${slot.startsAtUtc ?? 'slot'}`}
            slot={slot}
            onPress={slot.id ? () => openSlot(slot) : undefined}
          />
        ))}
      </YStack>
    );
  };

  return (
    <YStack flex={1} backgroundColor="$backgroundSoft">
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={handleRefresh}
          />
        }
        contentContainerStyle={{
          padding: 24,
          paddingBottom: tabBarHeight + 96,
        }}
      >
        <YStack gap="$4">
          <Text fontSize="$8" fontWeight="700" color="$text">
            {t('schedule.title')}
          </Text>
          <DateStrip
            dates={visibleDates}
            selectedDate={selectedDate}
            todayDate={todayDate}
            tomorrowDate={tomorrowDate}
            markers={slotMarkers}
            onSelectDate={handleSelectDate}
            onOpenCalendar={openDatePicker}
          />
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
          {summaryLabel ? (
            <Text fontSize="$4" fontWeight="600" color="$text">
              {summaryLabel}
            </Text>
          ) : null}
          {renderContent()}
        </YStack>
      </ScrollView>
      <Button
        position="absolute"
        right="$6"
        bottom={tabBarHeight + 24}
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
      <SlotActionsSheet
        open={sheetOpen}
        slot={activeSlot}
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
          completeMutation.mutate(slot.id);
        }}
        onMarkNoShow={(slot) => {
          if (!slot.id || noShowMutation.isPending) {
            return;
          }
          noShowMutation.mutate(slot.id);
        }}
        isCancelling={cancelMutation.isPending}
        isMarkingCompleted={completeMutation.isPending}
        isMarkingNoShow={noShowMutation.isPending}
        showAttendanceActions={attendanceActionsAvailable}
      />
    </YStack>
  );
}
