import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useEffect, useMemo, useState } from 'react';
import { Platform, RefreshControl } from 'react-native';
import { Button, Text, XStack, YStack } from 'tamagui';
import type { AvailableSlotTrainerDto, SlotDto } from '@generated/api';
import type { ClientBooking } from '@api/bookingsApi';
import { getClientUpcomingBookings } from '@api/bookingsApi';
import { getAvailableSlotsForClient } from '@api/slotsApi';
import { presentApiError } from '@api/ApiErrorPresenter';
import { getGenderLookups, getSpecializationLookups } from '@api/lookupsApi';
import { t } from '@i18n';
import { useAppQuery } from '@query/hooks';
import { keys } from '@query/keys';
import { Banner } from '@ui/feedback/Banner';
import { TabScrollView } from '@ui/layout/TabScrollView';
import { EmptyState } from '@ui/states/EmptyState';
import { AppIcon } from '@ui/AppIcon';
import { DateStrip } from '@app/components/schedule/DateStrip';
import { FilterSheet } from '@app/components/slots/FilterSheet';
import { TrainerAvatar } from '@app/components/bookings/TrainerAvatar';
import {
  DEFAULT_CLIENT_SLOTS_FILTERS,
  loadClientSlotsFilters,
  saveClientSlotsFilters,
  type ClientSlotsFilters,
} from '@app/utils/clientSlotsFilters';
import { formatTimeRangeRu } from '@utils/datetime';
import { formatPrice } from '@utils/price';
import type { SlotsStackParamList } from '@app/navigation/types';

const DATE_RANGE_DAYS = 14;

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
  defaultGender: string
): ClientSlotsFilters => {
  const specializations = filters.specializations.filter((item) => allowedSpecializations.has(item));
  const gender = filters.gender || defaultGender;
  return {
    gender,
    specializations: sortByOrder(specializations, specializationOrder),
  };
};

const getSlotRange = (slot: SlotDto): { start: number; end: number } | null => {
  if (!slot.startsAtUtc) {
    return null;
  }
  const start = new Date(slot.startsAtUtc).getTime();
  if (Number.isNaN(start)) {
    return null;
  }
  const duration = slot.durationMinutes ?? 0;
  return { start, end: start + duration * 60 * 1000 };
};

const hasTimeConflict = (slot: SlotDto, bookings: ClientBooking[]): boolean => {
  const slotRange = getSlotRange(slot);
  if (!slotRange) {
    return false;
  }
  return bookings.some((booking) => {
    const bookingRange = booking.slot ? getSlotRange(booking.slot) : null;
    if (!bookingRange) {
      return false;
    }
    return slotRange.start < bookingRange.end && bookingRange.start < slotRange.end;
  });
};

const normalizeStatus = (value?: string | null) => value?.toLowerCase().trim();

const isSlotOpen = (slot: SlotDto) => {
  const normalized = normalizeStatus(slot.status);
  return normalized === 'open' || normalized === 'available';
};

const sortSlotsByStart = (left: SlotDto, right: SlotDto) => {
  const leftTs = left.startsAtUtc ? new Date(left.startsAtUtc).getTime() : 0;
  const rightTs = right.startsAtUtc ? new Date(right.startsAtUtc).getTime() : 0;
  return leftTs - rightTs;
};

type SlotGroup = {
  trainer: AvailableSlotTrainerDto;
  slots: SlotDto[];
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

  const specializationsQuery = useAppQuery({
    queryKey: keys.lookups.specializations(),
    queryFn: ({ signal }) => getSpecializationLookups({ signal }),
  });

  const gendersQuery = useAppQuery({
    queryKey: keys.lookups.genders(),
    queryFn: ({ signal }) => getGenderLookups({ signal }),
  });

  const specializationOptions = specializationsQuery.data ?? [];
  const genderOptions = gendersQuery.data ?? [];
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
      resetGenderCode
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
  ]);

  const slotsQuery = useAppQuery({
    queryKey: slotParams ? keys.slots.available(slotParams) : keys.slots.available(),
    enabled: Boolean(slotParams),
    queryFn: ({ signal }) =>
      getAvailableSlotsForClient(slotParams ?? undefined, { signal }),
  });

  const bookingsQuery = useAppQuery({
    queryKey: keys.bookings.upcoming(),
    queryFn: ({ signal }) => getClientUpcomingBookings({ signal }),
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
      resetGenderCode
    ),
    [filters, specializationOrder, allowedSpecializations, resetGenderCode]
  );

  const hasActiveFilters =
    normalizedFilters.specializations.length > 0
    || (normalizedFilters.gender && normalizedFilters.gender !== resetGenderCode);

  const handleApplyFilters = (next: ClientSlotsFilters) => {
    const normalized = normalizeFilters(
      next,
      specializationOrder,
      allowedSpecializations,
      resetGenderCode
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

  const renderSlotRow = (slot: SlotDto, trainer: AvailableSlotTrainerDto) => {
    const times = slot.startsAtUtc ? new Date(slot.startsAtUtc) : null;
    const range = times
      ? {
        start: times,
        end: new Date(
          times.getTime() + (slot.durationMinutes ?? 0) * 60 * 1000
        ),
      }
      : null;
    const timeLabel = range
      ? formatTimeRangeRu(range.start, range.end)
      : t('common.empty');
    const priceLabel = formatPrice(
      slot.trainerPricePerSession ?? trainer.pricePerSession
    );
    const conflict = canCheckConflicts && hasTimeConflict(slot, bookings);
    const startTs = range?.start.getTime() ?? null;
    const isPast = startTs !== null && startTs <= nowTs;
    const open = isSlotOpen(slot);
    const isBookable = Boolean(slot.id) && open && !isPast && !conflict;
    const statusLabel = conflict
      ? t('slots.status.conflict')
      : open && !isPast
        ? t('slots.status.available')
        : t('slots.status.unavailable');
    const statusColor = conflict
      ? '$danger'
      : open && !isPast
        ? '$accent'
        : '$muted';

    return (
      <Button
        key={slot.id ?? `${slot.startsAtUtc ?? 'slot'}-${timeLabel}`}
        unstyled
        backgroundColor={isBookable ? '$background' : '$surfaceMuted'}
        borderRadius="$4"
        borderWidth={1}
        borderColor={isBookable ? '$border' : '$surfaceMuted'}
        padding="$3"
        alignItems="stretch"
        onPress={() => {
          if (!isBookable || !slot.id) {
            return;
          }
          navigation.navigate('ClientSlotDetails', {
            slot,
            trainer,
          });
        }}
        disabled={!isBookable}
      >
        <XStack justifyContent="space-between" alignItems="center">
          <Text fontSize="$4" fontWeight="600" color={isBookable ? '$text' : '$muted'}>
            {timeLabel}
          </Text>
          {priceLabel ? (
            <Text fontSize="$3" color={isBookable ? '$text' : '$muted'}>
              {priceLabel}
            </Text>
          ) : null}
        </XStack>
        <Text fontSize="$2" color={statusColor} marginTop="$1">
          {statusLabel}
        </Text>
      </Button>
    );
  };

  const renderTrainerCard = (group: SlotGroup, index: number) => {
    const trainer = group.trainer;
    const trainerName = trainer.name ?? t('common.empty');
    const ratingLabel = trainer.rating ? trainer.rating.toFixed(1) : null;

    return (
      <YStack
        key={trainer.id ?? `trainer-${index}`}
        gap="$3"
        padding="$4"
        backgroundColor="$background"
        borderRadius="$5"
        borderWidth={1}
        borderColor="$border"
      >
        <XStack alignItems="center" justifyContent="space-between" gap="$3">
          <XStack alignItems="center" gap="$3" flex={1}>
            <TrainerAvatar
              name={trainerName}
              avatarUrl={trainer.avatarUrl}
              size="$10"
            />
            <YStack gap="$1" flex={1}>
              <Text fontSize="$4" fontWeight="700" color="$text">
                {trainerName}
              </Text>
              {ratingLabel ? (
                <XStack alignItems="center" gap="$2">
                  <AppIcon name="star" size={14} color="$accent" />
                  <Text fontSize="$3" color="$muted">
                    {ratingLabel}
                  </Text>
                </XStack>
              ) : null}
            </YStack>
          </XStack>
        </XStack>

        <YStack gap="$2">
          {group.slots.map((slot) => renderSlotRow(slot, trainer))}
        </YStack>
      </YStack>
    );
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

    return <YStack gap="$4">{groups.map(renderTrainerCard)}</YStack>;
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
          <XStack justifyContent="space-between" alignItems="center">
            <YStack gap="$1">
              <Text fontSize="$8" fontWeight="700" color="$text">
                {t('slots.title')}
              </Text>
              <Text fontSize="$3" color="$muted">
                {t('slots.subtitle')}
              </Text>
            </YStack>
            <Button
              backgroundColor="$background"
              borderRadius="$4"
              borderWidth={1}
              borderColor="$border"
              minHeight="$9"
              paddingHorizontal="$3"
              onPress={() => setSheetOpen(true)}
            >
              <XStack alignItems="center" gap="$2">
                <AppIcon name="settings" size={18} color="$muted" />
                <Text fontSize="$3" color="$text">
                  {t('slots.filters.button')}
                </Text>
                {hasActiveFilters ? (
                  <YStack
                    width={6}
                    height={6}
                    borderRadius={3}
                    backgroundColor="$accent"
                  />
                ) : null}
              </XStack>
            </Button>
          </XStack>

          <DateStrip
            dates={visibleDates}
            selectedDate={selectedDate}
            todayDate={todayDate}
            tomorrowDate={tomorrowDate}
            onSelectDate={setSelectedDate}
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
        onApply={handleApplyFilters}
        onOpenChange={setSheetOpen}
      />
    </YStack>
  );
}
