import type { NativeStackScreenProps } from '@react-navigation/native-stack';
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
import { SlotActionsSheet } from '@app/components/schedule/SlotActionsSheet';
import { SlotCard } from '@app/components/schedule/SlotCard';
import {
  canMarkCompleted,
  canMarkNoShow,
  getSlotStartTimestamp,
  getUiSlotStatus,
} from '@app/components/schedule/slotHelpers';
import type { ScheduleStackParamList } from '@app/navigation/types';
import type { SlotDto } from '@generated/api';
import { t } from '@i18n';
import { useAppMutation, useAppQuery } from '@query/hooks';
import { keys } from '@query/keys';
import { useToast } from '@ui/feedback/useToast';
import { TabScrollView } from '@ui/layout/TabScrollView';
import { EmptyState } from '@ui/states/EmptyState';
import { ErrorState } from '@ui/states/ErrorState';
import { formatDateRu } from '@utils/datetime';

type Props = NativeStackScreenProps<ScheduleStackParamList, 'AttendanceQueue'>;

type SortOrder = 'asc' | 'desc';

type SlotDateSection = {
  key: string;
  title: string;
  slots: SlotDto[];
};

const NOW_REFRESH_INTERVAL_MS = 30 * 1000;
const PAST_DATE_RANGE_DAYS = 30;
const FUTURE_DATE_RANGE_DAYS = 14;

const startOfLocalDay = (value: Date) =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0);

const endOfLocalDay = (value: Date) =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate(), 23, 59, 59, 999);

const addDays = (value: Date, days: number) => {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
};

const buildDateKey = (value: Date): string => {
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${value.getFullYear()}-${month}-${day}`;
};

const compareByStartAsc = (left: SlotDto, right: SlotDto) => {
  const leftStart = getSlotStartTimestamp(left) ?? 0;
  const rightStart = getSlotStartTimestamp(right) ?? 0;
  return leftStart - rightStart;
};

const compareByStartDesc = (left: SlotDto, right: SlotDto) =>
  compareByStartAsc(right, left);

export function TrainerAttendanceQueueScreen({ navigation }: Props) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [nowTs, setNowTs] = useState(() => Date.now());
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [activeSlot, setActiveSlot] = useState<SlotDto | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  const dateRange = useMemo(() => {
    const today = startOfLocalDay(new Date());
    const fromUtc = startOfLocalDay(addDays(today, -PAST_DATE_RANGE_DAYS)).toISOString();
    const toUtc = endOfLocalDay(addDays(today, FUTURE_DATE_RANGE_DAYS)).toISOString();
    return { fromUtc, toUtc };
  }, []);

  const {
    data: slots = [],
    isLoading,
    isFetching,
    error,
    refetch,
  } = useAppQuery({
    queryKey: keys.trainerSlots.mine(dateRange),
    queryFn: ({ signal }) => getMyTrainerSlots(dateRange, { signal }),
    refetchInterval: NOW_REFRESH_INTERVAL_MS,
    refetchIntervalInBackground: false,
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

  const attentionSlots = useMemo(() =>
    slots.filter((slot) => getUiSlotStatus(slot, nowTs) === 'needs_attention'),
  [slots, nowTs]);

  const sortedAttentionSlots = useMemo(() => {
    const comparator = sortOrder === 'asc' ? compareByStartAsc : compareByStartDesc;
    return attentionSlots.slice().sort(comparator);
  }, [attentionSlots, sortOrder]);

  const sections = useMemo(() => {
    const grouped: SlotDateSection[] = [];
    sortedAttentionSlots.forEach((slot) => {
      const startTs = getSlotStartTimestamp(slot);
      if (startTs === null) {
        return;
      }
      const date = new Date(startTs);
      const key = buildDateKey(date);
      const title = formatDateRu(date);
      const last = grouped[grouped.length - 1];
      if (!last || last.key !== key) {
        grouped.push({ key, title, slots: [slot] });
        return;
      }
      last.slots.push(slot);
    });
    return grouped;
  }, [sortedAttentionSlots]);

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
    onError: (mutationError, _variables, context) => {
      if (context?.snapshot) {
        rollbackSlotsCache(context.snapshot);
      }
      const presented = presentApiError(mutationError);
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

  const openSlot = useCallback((slot: SlotDto) => {
    if (!slot.id) {
      return;
    }
    if ((slot.slotType ?? '').toLowerCase().trim() === 'group') {
      navigation.navigate('SlotDetails', { slot });
      return;
    }
    setActiveSlot(slot);
    setSheetOpen(true);
  }, [navigation]);

  const handleRefresh = useCallback(async () => {
    setIsManualRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsManualRefreshing(false);
    }
  }, [refetch]);

  return (
    <YStack flex={1} backgroundColor="$backgroundSoft">
      <TabScrollView
        refreshControl={(
          <RefreshControl
            refreshing={isManualRefreshing && isFetching && !isLoading}
            onRefresh={handleRefresh}
          />
        )}
        contentContainerStyle={{
          padding: 24,
        }}
        extraBottom={48}
      >
        <YStack gap="$4">
          <Text fontSize="$8" fontWeight="700" color="$text">
            {t('attendanceQueue.title')}
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
              { id: 'asc', label: t('attendanceQueue.sortAsc') },
              { id: 'desc', label: t('attendanceQueue.sortDesc') },
            ] as const).map((option) => {
              const active = sortOrder === option.id;
              return (
                <Button
                  key={option.id}
                  unstyled
                  flex={1}
                  paddingVertical="$2"
                  borderRadius="$3"
                  backgroundColor={active ? '$background' : 'transparent'}
                  onPress={() => setSortOrder(option.id)}
                >
                  <Text
                    fontSize="$3"
                    fontWeight={active ? '700' : '600'}
                    color={active ? '$text' : '$muted'}
                    textAlign="center"
                  >
                    {option.label}
                  </Text>
                </Button>
              );
            })}
          </XStack>
          {error ? <ErrorState error={error} onRetry={refetch} /> : null}
          {!error && !isLoading && sections.length === 0 ? (
            <EmptyState title={t('attendanceQueue.empty')} />
          ) : null}
          {!error && sections.length > 0 ? (
            <YStack gap="$5">
              {sections.map((section) => (
                <YStack key={section.key} gap="$3">
                  <Text fontSize="$5" fontWeight="700" color="$text">
                    {section.title}
                  </Text>
                  <YStack gap="$4">
                    {section.slots.map((slot) => (
                      <SlotCard
                        key={slot.id ?? `${slot.startsAtUtc ?? 'slot'}`}
                        slot={slot}
                        nowTs={nowTs}
                        onPress={slot.id ? () => openSlot(slot) : undefined}
                      />
                    ))}
                  </YStack>
                </YStack>
              ))}
            </YStack>
          ) : null}
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
    </YStack>
  );
}
