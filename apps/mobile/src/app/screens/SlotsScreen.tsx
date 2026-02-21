import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useEffect, useMemo, useState } from 'react';
import { Platform, RefreshControl } from 'react-native';
import { YStack } from 'tamagui';
import type { SlotDto } from '@generated/api';
import {
  confirmClientBooking,
  declineClientBooking,
  getClientUpcomingBookings,
} from '@api/bookingsApi';
import { me } from '@api/authApi';
import { getAvailableSlotsForClient } from '@api/slotsApi';
import { presentApiError } from '@api/ApiErrorPresenter';
import { getGenderLookups, getSpecializationLookups } from '@api/lookupsApi';
import { t } from '@i18n';
import { useAppMutation, useAppQuery } from '@query/hooks';
import { keys } from '@query/keys';
import { useQueryClient } from '@tanstack/react-query';
import { IOSDatePickerCard } from '@ui/components';
import { Banner } from '@ui/feedback/Banner';
import { useToast } from '@ui/feedback/useToast';
import { TabScrollView } from '@ui/layout/TabScrollView';
import { addDays, endOfLocalDay, startOfLocalDay } from '@utils/localDate';
import { DateStrip } from '@app/components/schedule/DateStrip';
import { FilterSheet } from '@app/components/slots/FilterSheet';
import {
  DEFAULT_CLIENT_SLOTS_FILTERS,
  loadClientSlotsFilters,
  saveClientSlotsFilters,
  type ClientSlotsFilters,
} from '@app/utils/clientSlotsFilters';
import type { SlotsStackParamList } from '@app/navigation/types';
import { SlotsHeader } from './slots/ui/SlotsHeader';
import { ClientSlotDetailsSheet } from './slots/ui/ClientSlotDetailsSheet';
import type { SlotGroup } from './slots/ui/TrainerSlotGroupCard';
import { SlotsGroupsContent } from './slots/ui/SlotsGroupsContent';
import {
  getAnyCode,
  getDefaultCode,
  normalizeFilters,
  sortSlotsByStart,
} from './slots/slotFilterUtils';

const DATE_RANGE_DAYS = 14;
const LIVE_REFRESH_INTERVAL_MS = 15 * 1000;

type Props = NativeStackScreenProps<SlotsStackParamList, 'SlotsList'>;

export function SlotsScreen({ navigation }: Props) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [selectedDate, setSelectedDate] = useState(() => startOfLocalDay(new Date()));
  const [filters, setFilters] = useState<ClientSlotsFilters>(DEFAULT_CLIENT_SLOTS_FILTERS);
  const [filtersReady, setFiltersReady] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const [activeSlot, setActiveSlot] = useState<SlotDto | null>(null);
  const [activeTrainer, setActiveTrainer] = useState<SlotGroup['trainer'] | null>(null);
  const [slotDetailsSheetOpen, setSlotDetailsSheetOpen] = useState(false);
  const [pendingActionBookingId, setPendingActionBookingId] = useState<string | null>(null);

  const specializationsQuery = useAppQuery({
    queryKey: keys.lookups.specializations(),
    queryFn: ({ signal }) => getSpecializationLookups({ signal }),
  });

  const gendersQuery = useAppQuery({
    queryKey: keys.lookups.genders(),
    queryFn: ({ signal }) => getGenderLookups({ signal }),
  });

  const meQuery = useAppQuery({
    queryKey: keys.auth.me(),
    queryFn: ({ signal }) => me({ signal }),
  });

  const specializationOptions = useMemo(
    () => specializationsQuery.data ?? [],
    [specializationsQuery.data]
  );
  const genderOptions = useMemo(
    () => gendersQuery.data ?? [],
    [gendersQuery.data]
  );
  const specializationOrder = useMemo(
    () => new Map(specializationOptions.map((item, index) => [item.code, index])),
    [specializationOptions]
  );
  const allowedSpecializations = useMemo(
    () => new Set(specializationOptions.map((item) => item.code)),
    [specializationOptions]
  );
  const anyGenderCode = useMemo(() => getAnyCode(genderOptions), [genderOptions]);
  const defaultGenderCode = useMemo(() => getDefaultCode(genderOptions), [genderOptions]);
  const resetGenderCode = anyGenderCode || defaultGenderCode || '';
  const lookupsReady = !specializationsQuery.isLoading && !gendersQuery.isLoading;
  const canFilterDistrict = typeof meQuery.data?.districtId === 'number';

  const todayDate = useMemo(() => startOfLocalDay(new Date()), []);
  const tomorrowDate = useMemo(() => addDays(todayDate, 1), [todayDate]);
  const maxDate = useMemo(() => addDays(todayDate, DATE_RANGE_DAYS), [todayDate]);

  useEffect(() => {
    let isActive = true;
    loadClientSlotsFilters().then((stored) => {
      if (!isActive) {
        return;
      }
      setFilters(stored);
      setFiltersReady(true);
    });
    return () => {
      isActive = false;
    };
  }, []);

  const visibleDates = useMemo(
    () => Array.from({ length: DATE_RANGE_DAYS + 1 }, (_, index) => addDays(todayDate, index)),
    [todayDate]
  );

  const fromUtc = useMemo(() => startOfLocalDay(selectedDate).toISOString(), [selectedDate]);
  const toUtc = useMemo(() => endOfLocalDay(selectedDate).toISOString(), [selectedDate]);

  const slotParams = useMemo(() => {
    if (!filtersReady || !lookupsReady) {
      return null;
    }
    const normalized = normalizeFilters(
      filters,
      specializationOrder,
      allowedSpecializations,
      resetGenderCode,
      canFilterDistrict
    );
    return {
      fromUtc,
      toUtc,
      specializations: normalized.specializations.length
        ? normalized.specializations
        : undefined,
      gender: normalized.gender && normalized.gender !== resetGenderCode
        ? normalized.gender
        : undefined,
      districtOnly: normalized.districtOnly ? true : undefined,
    };
  }, [
    filters,
    filtersReady,
    lookupsReady,
    fromUtc,
    toUtc,
    specializationOrder,
    allowedSpecializations,
    resetGenderCode,
    canFilterDistrict,
  ]);

  const slotsQuery = useAppQuery({
    queryKey: slotParams ? keys.slots.available(slotParams) : keys.slots.available(),
    enabled: Boolean(slotParams),
    queryFn: ({ signal }) =>
      getAvailableSlotsForClient(slotParams ?? undefined, { signal }),
    refetchInterval: LIVE_REFRESH_INTERVAL_MS,
    refetchIntervalInBackground: true,
  });

  const bookingsQuery = useAppQuery({
    queryKey: keys.bookings.upcoming(),
    queryFn: ({ signal }) => getClientUpcomingBookings({ signal }),
    refetchInterval: LIVE_REFRESH_INTERVAL_MS,
    refetchIntervalInBackground: true,
  });

  const bookings = bookingsQuery.data ?? [];
  const canCheckConflicts = bookingsQuery.isSuccess && !bookingsQuery.isFetching;
  const nowTs = Date.now();

  const invalidateClientData = () => {
    queryClient.invalidateQueries({ queryKey: keys.slots.available() });
    queryClient.invalidateQueries({ queryKey: keys.bookings.upcoming() });
    queryClient.invalidateQueries({ queryKey: keys.pendingBookingConfirmationsCount() });
  };

  const confirmPendingMutation = useAppMutation({
    mutationFn: async (bookingId: string) => {
      setPendingActionBookingId(bookingId);
      await confirmClientBooking(bookingId);
    },
    onSuccess: () => {
      setPendingActionBookingId(null);
      invalidateClientData();
      showToast({ type: 'success', title: t('bookingConfirm.confirmed') });
    },
    onError: (error) => {
      setPendingActionBookingId(null);
      const presented = presentApiError(error);
      showToast({ type: 'error', title: presented.title, message: presented.message });
    },
  });

  const declinePendingMutation = useAppMutation({
    mutationFn: async (bookingId: string) => {
      setPendingActionBookingId(bookingId);
      await declineClientBooking(bookingId);
    },
    onSuccess: () => {
      setPendingActionBookingId(null);
      invalidateClientData();
      showToast({ type: 'success', title: t('bookingConfirm.declined') });
    },
    onError: (error) => {
      setPendingActionBookingId(null);
      const presented = presentApiError(error);
      showToast({ type: 'error', title: presented.title, message: presented.message });
    },
  });

  const groups = useMemo(() => {
    const rawGroups = slotsQuery.data ?? [];
    return rawGroups
      .map((group) => {
        const trainer = group.trainer;
        const slots = (group.slots ?? []).filter((slot): slot is SlotDto => !!slot);
        if (!trainer || slots.length === 0) {
          return null;
        }
        return {
          trainer,
          slots: [...slots].sort(sortSlotsByStart),
        } as SlotGroup;
      })
      .filter((group): group is SlotGroup => group !== null)
      .sort((left, right) => {
        const leftStart = left.slots[0]?.startsAtUtc
          ? new Date(left.slots[0].startsAtUtc).getTime()
          : Number.MAX_SAFE_INTEGER;
        const rightStart = right.slots[0]?.startsAtUtc
          ? new Date(right.slots[0].startsAtUtc).getTime()
          : Number.MAX_SAFE_INTEGER;
        return leftStart - rightStart;
      });
  }, [slotsQuery.data]);

  const normalizedFilters = useMemo(
    () => normalizeFilters(
      filters,
      specializationOrder,
      allowedSpecializations,
      resetGenderCode,
      canFilterDistrict
    ),
    [filters, specializationOrder, allowedSpecializations, resetGenderCode, canFilterDistrict]
  );

  const hasActiveFilters =
    normalizedFilters.specializations.length > 0
    || (normalizedFilters.gender && normalizedFilters.gender !== resetGenderCode)
    || normalizedFilters.districtOnly;

  const handleApplyFilters = (next: ClientSlotsFilters) => {
    const normalized = normalizeFilters(
      next,
      specializationOrder,
      allowedSpecializations,
      resetGenderCode,
      canFilterDistrict
    );
    setFilters(normalized);
    saveClientSlotsFilters(normalized).catch(() => undefined);
  };

  const handleResetFilters = () => {
    const reset = { ...DEFAULT_CLIENT_SLOTS_FILTERS, gender: resetGenderCode };
    setFilters(reset);
    saveClientSlotsFilters(reset).catch(() => undefined);
  };

  const openDatePicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: selectedDate,
        mode: 'date',
        display: 'calendar',
        minimumDate: todayDate,
        maximumDate: maxDate,
        onChange: handleDateChange,
      });
      return;
    }
    setPickerVisible(true);
  };

  const handleDateChange = (_event: DateTimePickerEvent, date?: Date) => {
    if (!date) {
      return;
    }
    const normalized = startOfLocalDay(date);
    setSelectedDate(normalized);
    if (Platform.OS === 'android') {
      return;
    }
  };

  const handleRefresh = async () => {
    setIsManualRefreshing(true);
    try {
      await Promise.allSettled([
        slotsQuery.refetch(),
        bookingsQuery.refetch(),
      ]);
    } finally {
      setIsManualRefreshing(false);
    }
  };

  const showErrorBanner = Boolean(slotsQuery.error);
  const errorMessage = slotsQuery.error
    ? presentApiError(slotsQuery.error).message
    : null;

  return (
    <YStack flex={1} backgroundColor="$backgroundSoft">
      <TabScrollView
        refreshControl={
          <RefreshControl
            refreshing={isManualRefreshing && (slotsQuery.isFetching || bookingsQuery.isFetching)}
            onRefresh={handleRefresh}
          />
        }
        contentContainerStyle={{ padding: 24 }}
        extraBottom={72}
      >
        <YStack gap="$4">
          <SlotsHeader
            hasActiveFilters={hasActiveFilters}
            onOpenFilters={() => setSheetOpen(true)}
          />

          <DateStrip
            dates={visibleDates}
            selectedDate={selectedDate}
            todayDate={todayDate}
            tomorrowDate={tomorrowDate}
            onSelectDate={setSelectedDate}
            onOpenCalendar={openDatePicker}
          />

          {pickerVisible && Platform.OS === 'ios' ? (
            <IOSDatePickerCard
              value={selectedDate}
              minimumDate={todayDate}
              maximumDate={maxDate}
              onChange={handleDateChange}
              onClose={() => setPickerVisible(false)}
            />
          ) : null}

          {showErrorBanner && errorMessage ? (
            <Banner
              type="error"
              title={errorMessage}
              actionLabel={t('common.retry')}
              onAction={handleRefresh}
            />
          ) : null}

          <SlotsGroupsContent
            filtersReady={filtersReady}
            lookupsReady={lookupsReady}
            isLoading={slotsQuery.isLoading}
            groups={groups}
            hasActiveFilters={hasActiveFilters}
            onResetFilters={handleResetFilters}
            onOpenDatePicker={openDatePicker}
            bookings={bookings}
            canCheckConflicts={canCheckConflicts}
            nowTs={nowTs}
            pendingActionBookingId={pendingActionBookingId}
            onConfirmPending={(bookingId) => confirmPendingMutation.mutate(bookingId)}
            onDeclinePending={(bookingId) => declinePendingMutation.mutate(bookingId)}
            onOpenSlot={(slot, trainer) => {
              setActiveSlot(slot);
              setActiveTrainer(trainer);
              setSlotDetailsSheetOpen(true);
            }}
          />
        </YStack>
      </TabScrollView>

      <FilterSheet
        open={sheetOpen}
        filters={filters}
        specializationOptions={specializationOptions}
        genderOptions={genderOptions}
        resetGenderCode={resetGenderCode}
        canFilterDistrict={canFilterDistrict}
        onApply={handleApplyFilters}
        onOpenChange={setSheetOpen}
      />
      <ClientSlotDetailsSheet
        open={slotDetailsSheetOpen}
        slot={activeSlot}
        trainer={activeTrainer}
        bookings={bookings}
        canCheckConflicts={canCheckConflicts}
        nowTs={nowTs}
        onOpenChange={(open) => {
          setSlotDetailsSheetOpen(open);
          if (!open) {
            setActiveSlot(null);
            setActiveTrainer(null);
          }
        }}
        onBooked={() => {
          navigation.getParent()?.navigate('Bookings', { screen: 'BookingsHome' });
        }}
      />
    </YStack>
  );
}
