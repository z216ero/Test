import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, RefreshControl } from 'react-native';
import { Button, Text, YStack } from 'tamagui';
import {
  attendanceActionsAvailable,
  getMyTrainerSlots,
} from '@api/trainerSlotsApi';
import { getTrainerClientLinks } from '@api/clientLinksApi';
import type { SlotDto } from '@generated/api';
import { t } from '@i18n';
import { useAppQuery } from '@query/hooks';
import { keys } from '@query/keys';
import { IOSDatePickerCard } from '@ui/components';
import { useToast } from '@ui/feedback/useToast';
import { useTabBarPadding } from '@ui/layout/useTabBarPadding';
import { TabScrollView } from '@ui/layout/TabScrollView';
import { AppIcon } from '@ui/AppIcon';
import { buildDateKey } from '@utils/localDate';
import type { ScheduleStackParamList } from '@app/navigation/types';
import { DateStrip } from '@app/components/schedule/DateStrip';
import { SlotActionsSheet } from '@app/components/schedule/SlotActionsSheet';
import {
  canMarkNoShow,
  canMarkCompleted,
  isClientDeclinedSlot,
  isActiveSlotForMainList,
  getUiSlotStatus,
  shouldShowInCompletedToday,
} from '@app/components/schedule/slotHelpers';
import {
  clearScheduleBadge,
  markDeclinedSlotReleased,
  usePushIndicators,
} from '@notifications/pushIndicators';
import { useScheduleSlotMutations } from './schedule/useScheduleSlotMutations';
import { ScheduleSlotsContent } from './schedule/ui/ScheduleSlotsContent';
import { ScheduleReassignSheet } from './schedule/ui/ScheduleReassignSheet';
import { useScheduleDateState } from './schedule/useScheduleDateState';
import { confirmCancelSlot } from './schedule/confirmCancelSlot';
import { useScheduleSheetState } from './schedule/useScheduleSheetState';

const NOW_REFRESH_INTERVAL_MS = 30 * 1000;

const sortByStart = (a: SlotDto, b: SlotDto) => (a.startsAtUtc ? new Date(a.startsAtUtc).getTime() : 0) - (b.startsAtUtc ? new Date(b.startsAtUtc).getTime() : 0);

type Props = NativeStackScreenProps<ScheduleStackParamList, 'ScheduleHome'>;

export function ScheduleScreen({ navigation, route }: Props) {
  const { showToast } = useToast();
  const { contentBottomPadding } = useTabBarPadding();
  const { slotHighlights, releasedDeclinedSlots } = usePushIndicators();
  const initialDateIsoLocal = route.params?.initialDateIsoLocal;
  const {
    activeSlot,
    setActiveSlot,
    sheetOpen,
    setSheetOpen,
    reassignSheetOpen,
    setReassignSheetOpen,
    reassignSlot,
    setReassignSlot,
    reassignSearch,
    setReassignSearch,
    openSlot,
    closeSheet,
    closeReassignSheet,
  } = useScheduleSheetState({ navigation });

  const {
    selectedDate,
    todayDate,
    tomorrowDate,
    pickerVisible,
    setPickerVisible,
    dateRange,
    minDate,
    maxDate,
    visibleDates,
    isSelectedToday,
    isPastDay,
    canCreateSlot,
    handleSelectDate,
    handleDateChange,
    openDatePicker,
  } = useScheduleDateState({ initialDateIsoLocal });

  const [slotMarkers, setSlotMarkers] = useState<Record<string, boolean>>({});
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [completedExpanded, setCompletedExpanded] = useState(false);
  const [releasedDeclinedSlotsLocal, setReleasedDeclinedSlotsLocal] = useState<Record<string, boolean>>({});

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

  const linkedClientsQuery = useAppQuery({
    queryKey: keys.myClients(),
    queryFn: ({ signal }) => getTrainerClientLinks().then((items) => {
      if (signal.aborted) {
        return [];
      }
      return items.filter((item) => (item.status ?? '').toLowerCase() === 'accepted');
    }),
  });

  useFocusEffect(
    useCallback(() => {
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
  const isDeclinedReleased = useCallback((slotId?: string | null) => {
    if (!slotId) {
      return false;
    }
    return Boolean(releasedDeclinedSlotsLocal[slotId] || releasedDeclinedSlots[slotId]);
  }, [releasedDeclinedSlots, releasedDeclinedSlotsLocal]);

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

  const sortedSlots = useMemo(() => slots.slice().sort(sortByStart), [slots]);

  const activeSlots = useMemo(
    () => sortedSlots.filter((slot) => isActiveSlotForMainList(slot, nowTs)),
    [sortedSlots, nowTs]
  );

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
      if (status === 'pending_confirmation' || status === 'client_declined') {
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
  const {
    cancelMutation,
    closeBookingMutation,
    assignAnotherClientMutation,
  } = useScheduleSlotMutations({
    activeSlot,
    setActiveSlot,
    refetch,
    closeSheet,
    closeReassignSheet,
    showToast,
  });

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
            <IOSDatePickerCard
              value={selectedDate}
              minimumDate={minDate}
              maximumDate={maxDate}
              onChange={handleDateChange}
              onClose={() => setPickerVisible(false)}
            />
          ) : null}
          {summaryLabel ? (
            <Text fontSize="$4" fontWeight="600" color="$text">
              {summaryLabel}
            </Text>
          ) : null}
          <ScheduleSlotsContent
            isLoading={isLoading}
            error={error}
            onRetry={refetch}
            isPastDay={isPastDay}
            sortedSlots={sortedSlots}
            activeSlots={activeSlots}
            nowTs={nowTs}
            canCreateSlot={canCreateSlot}
            isSelectedToday={isSelectedToday}
            completedTodaySlots={completedTodaySlots}
            completedExpanded={completedExpanded}
            onToggleCompleted={() => setCompletedExpanded((prev) => !prev)}
            onCreateSlot={handleCreateSlot}
            onOpenSlot={openSlot}
            getHighlightForSlot={getHighlightForSlot}
            isDeclinedReleased={isDeclinedReleased}
          />
        </YStack>
      </TabScrollView>
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
      <SlotActionsSheet
        open={sheetOpen}
        slot={activeSlot}
        statusOverride={
          activeSlot?.id
            && isClientDeclinedSlot(activeSlot, nowTs)
            && !isDeclinedReleased(activeSlot.id)
            ? 'client_declined'
            : undefined
        }
        nowTs={nowTs}
        onOpenChange={(open) => {
          if (!open) {
            closeSheet();
          } else {
            setSheetOpen(open);
          }
        }}
        onCancelSlot={(slot) => confirmCancelSlot({
          slot,
          nowTs,
          isPending: cancelMutation.isPending,
          onConfirm: (slotId) => cancelMutation.mutate(slotId),
        })}
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
        onAssignAnotherClient={(slot) => {
          if (!slot.id) {
            return;
          }
          setReassignSlot(slot);
          setReassignSheetOpen(true);
        }}
        onMakeSlotOpen={(slot) => {
          if (!slot.id) {
            return;
          }
          setReleasedDeclinedSlotsLocal((current) => ({ ...current, [slot.id as string]: true }));
          markDeclinedSlotReleased(slot.id).catch(() => {});
          closeSheet();
        }}
        isAssigningAnotherClient={assignAnotherClientMutation.isPending}
      />
      <ScheduleReassignSheet
        open={reassignSheetOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeReassignSheet();
            return;
          }
          setReassignSheetOpen(open);
        }}
        search={reassignSearch}
        onSearchChange={setReassignSearch}
        clients={linkedClientsQuery.data ?? []}
        isLoading={linkedClientsQuery.isLoading}
        isAssigning={assignAnotherClientMutation.isPending}
        selectedSlotId={reassignSlot?.id}
        onAssign={({ slotId, clientUserId }) => {
          assignAnotherClientMutation.mutate({ slotId, clientUserId });
        }}
        onClose={closeReassignSheet}
      />
    </YStack>
  );
}



