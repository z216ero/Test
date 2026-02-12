import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useEffect, useMemo, useState } from 'react';
import { Platform, RefreshControl } from 'react-native';
import { XStack, YStack } from 'tamagui';
import type { AvailableSlotTrainerDto, SlotDto } from '@generated/api';
import { getClientUpcomingBookings } from '@api/bookingsApi';
import { me } from '@api/authApi';
import { getAvailableSlotsForClient } from '@api/slotsApi';
import { presentApiError } from '@api/ApiErrorPresenter';
import { getGenderLookups, getSpecializationLookups } from '@api/lookupsApi';
import { t } from '@i18n';
import { useAppQuery } from '@query/hooks';
import { keys } from '@query/keys';
import { IOSDatePickerCard } from '@ui/components';
import { Banner } from '@ui/feedback/Banner';
import { TabScrollView } from '@ui/layout/TabScrollView';
import { EmptyState } from '@ui/states/EmptyState';
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
import { TrainerProfileSheet } from './slots/ui/TrainerProfileSheet';
import { type SlotGroup, TrainerSlotGroupCard } from './slots/ui/TrainerSlotGroupCard';

const DATE_RANGE_DAYS = 14;
const LIVE_REFRESH_INTERVAL_MS = 15 * 1000;

const startOfLocalDay = (value: Date) =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0);

const endOfLocalDay = (value: Date) =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate(), 23, 59, 59, 999);

const addDays = (value: Date, days: number) => {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
};

const getDefaultCode = (items: { code: string; isDefault?: boolean }[]) =>
  items.find((item) => item.isDefault)?.code ?? items[0]?.code ?? '';

const getAnyCode = (items: { code: string; isAny?: boolean }[]) =>
  items.find((item) => item.isAny)?.code ?? '';

const sortByOrder = (values: string[], order: Map<string, number>): string[] =>
  [...new Set(values)].sort((left, right) => {
    const leftIndex = order.get(left) ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = order.get(right) ?? Number.MAX_SAFE_INTEGER;
    return leftIndex - rightIndex;
  });

const normalizeFilters = (
  filters: ClientSlotsFilters,
  specializationOrder: Map<string, number>,
  allowedSpecializations: Set<string>,
  defaultGender: string,
  canFilterDistrict: boolean
): ClientSlotsFilters => {
  const specializations = filters.specializations.filter((item) => allowedSpecializations.has(item));
  const gender = filters.gender || defaultGender;
  const districtOnly = canFilterDistrict ? filters.districtOnly : false;
  return {
    gender,
    specializations: sortByOrder(specializations, specializationOrder),
    districtOnly,
  };
};

const sortSlotsByStart = (left: SlotDto, right: SlotDto) => {
  const leftTs = left.startsAtUtc ? new Date(left.startsAtUtc).getTime() : 0;
  const rightTs = right.startsAtUtc ? new Date(right.startsAtUtc).getTime() : 0;
  return leftTs - rightTs;
};

type Props = NativeStackScreenProps<SlotsStackParamList, 'SlotsList'>;

const SlotsSkeleton = () => (
  <YStack gap="$4">
    {Array.from({ length: 2 }).map((_, index) => (
      <YStack
        key={`skeleton-${index}`}
        gap="$3"
        padding="$4"
        backgroundColor="$background"
        borderRadius="$5"
        borderWidth={1}
        borderColor="$border"
      >
        <XStack gap="$3" alignItems="center">
          <YStack width="$10" height="$10" borderRadius="$6" backgroundColor="$surfaceMuted" />
          <YStack gap="$2" flex={1}>
            <YStack height={16} width="60%" backgroundColor="$surfaceMuted" borderRadius="$3" />
            <YStack height={12} width="40%" backgroundColor="$surfaceMuted" borderRadius="$3" />
          </YStack>
        </XStack>
        <YStack gap="$2">
          <YStack height={14} width="80%" backgroundColor="$surfaceMuted" borderRadius="$3" />
          <YStack height={14} width="70%" backgroundColor="$surfaceMuted" borderRadius="$3" />
        </YStack>
      </YStack>
    ))}
  </YStack>
);

export function SlotsScreen({ navigation }: Props) {
  const [selectedDate, setSelectedDate] = useState(() => startOfLocalDay(new Date()));
  const [filters, setFilters] = useState<ClientSlotsFilters>(DEFAULT_CLIENT_SLOTS_FILTERS);
  const [filtersReady, setFiltersReady] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [trainerProfileSheetOpen, setTrainerProfileSheetOpen] = useState(false);
  const [selectedTrainer, setSelectedTrainer] = useState<AvailableSlotTrainerDto | null>(null);

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

  const handleRefresh = () => {
    slotsQuery.refetch();
    bookingsQuery.refetch();
  };

  const renderContent = () => {
    if (!filtersReady || !lookupsReady || slotsQuery.isLoading) {
      return <SlotsSkeleton />;
    }

    if (groups.length === 0) {
      if (hasActiveFilters) {
        return (
          <EmptyState
            title={t('slots.empty.filtersTitle')}
            ctaLabel={t('slots.empty.resetFilters')}
            onCtaPress={handleResetFilters}
          />
        );
      }

      return (
        <EmptyState
          title={t('slots.empty.dateTitle')}
          ctaLabel={t('slots.empty.changeDate')}
          onCtaPress={openDatePicker}
        />
      );
    }

    return (
      <YStack gap="$4">
        {groups.map((group) => (
          <TrainerSlotGroupCard
            key={group.trainer.id ?? `trainer-${group.trainer.name ?? 'unknown'}`}
            group={group}
            bookings={bookings}
            canCheckConflicts={canCheckConflicts}
            nowTs={nowTs}
            onOpenSlot={(slot, trainer) => {
              navigation.navigate('ClientSlotDetails', { slot, trainer });
            }}
            onOpenTrainerProfile={(trainer) => {
              setSelectedTrainer(trainer);
              setTrainerProfileSheetOpen(true);
            }}
          />
        ))}
      </YStack>
    );
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
            refreshing={slotsQuery.isFetching && !slotsQuery.isLoading}
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

          {renderContent()}
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

      <TrainerProfileSheet
        open={trainerProfileSheetOpen}
        trainer={selectedTrainer}
        onOpenChange={(open) => {
          setTrainerProfileSheetOpen(open);
          if (!open) {
            setSelectedTrainer(null);
          }
        }}
      />
    </YStack>
  );
}
