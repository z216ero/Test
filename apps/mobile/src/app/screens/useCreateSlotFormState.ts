import type { QueryKey } from '@tanstack/react-query';
import {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import type {
  CreateSlotRequest,
  GetTrainersTrainerIdSlotsParams,
  SlotDto,
} from '../../generated/api';
import { ApiError } from '../../api/core';
import { ApiTimeoutError } from '../../api/fetcher';
import { TrainerSlotsOverlapError } from '../../api/trainerSlotsApi';
import { t } from '../../i18n';
import { useAppMutation, useAppQuery } from '../../query/hooks';
import { useToast } from '../../ui/feedback/useToast';
import { formatTimeRangeRu } from '../../utils/datetime';
import {
  buildTimeGrid,
  computeRange,
  getDisabledStartTimes,
  isSlotRangeAvailable,
  GRID_STEP_MINUTES,
  SLOT_DURATION_MINUTES,
  WORKDAY_END_HOUR,
  WORKDAY_START_HOUR,
  type LocalSlotRange,
} from '../../utils/slotTimeGrid';
import { presentApiError } from '../../api/ApiErrorPresenter';
import { useFocusEffect } from '@react-navigation/native';

export type UseCreateSlotFormStateArgs = {
  buildQueryKey: (params: GetTrainersTrainerIdSlotsParams) => QueryKey;
  loadSlots: (
    params: GetTrainersTrainerIdSlotsParams,
    options?: RequestInit
  ) => Promise<SlotDto[]>;
  createSlot: (payload: CreateSlotRequest, options?: RequestInit) => Promise<SlotDto>;
  onAfterSuccess: (count: number) => void;
  initialDateIsoLocal?: string;
};

export const MULTI_COUNTS = [2, 3, 4] as const;

const startOfLocalDay = (value: Date) =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0);

const isSameLocalDay = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear()
  && left.getMonth() === right.getMonth()
  && left.getDate() === right.getDate();

const parseLocalDate = (value?: string | null): Date | null => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return startOfLocalDay(parsed);
};

const resolveDatePreset = (
  value: Date,
  today: Date,
  tomorrow: Date
): 'today' | 'tomorrow' | 'custom' => {
  if (isSameLocalDay(value, today)) {
    return 'today';
  }
  if (isSameLocalDay(value, tomorrow)) {
    return 'tomorrow';
  }
  return 'custom';
};

export const formatTimeLabel = (value: Date): string =>
  new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(value);

export const formatWeekdayDate = (value: Date): string => {
  const raw = new Intl.DateTimeFormat('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  }).format(value);
  const cleaned = raw.replace('.', '');
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
};

const buildSequentialRanges = (startLocal: Date, count: number): LocalSlotRange[] =>
  Array.from({ length: count }).map((_, index) =>
    computeRange(
      new Date(startLocal.getTime() + index * SLOT_DURATION_MINUTES * 60 * 1000),
      SLOT_DURATION_MINUTES
    )
  );

const isRangeWithinWorkday = (range: LocalSlotRange): boolean => {
  const dayStart = new Date(
    range.startLocal.getFullYear(),
    range.startLocal.getMonth(),
    range.startLocal.getDate(),
    WORKDAY_START_HOUR,
    0,
    0,
    0
  );
  const dayEnd = new Date(
    range.startLocal.getFullYear(),
    range.startLocal.getMonth(),
    range.startLocal.getDate(),
    WORKDAY_END_HOUR,
    0,
    0,
    0
  );
  const endOfDay = new Date(
    range.startLocal.getFullYear(),
    range.startLocal.getMonth(),
    range.startLocal.getDate(),
    23,
    59,
    59,
    999
  );

  return (
    range.startLocal >= dayStart
    && range.endLocal <= dayEnd
    && range.endLocal <= endOfDay
    && isSameLocalDay(range.startLocal, range.endLocal)
  );
};

export const useCreateSlotFormState = ({
  buildQueryKey,
  loadSlots,
  createSlot,
  onAfterSuccess,
  initialDateIsoLocal,
}: UseCreateSlotFormStateArgs) => {
  const { showToast } = useToast();
  const [selectedDate, setSelectedDate] = useState(() => {
    const initial = parseLocalDate(initialDateIsoLocal);
    return initial ?? startOfLocalDay(new Date());
  });
  const [datePreset, setDatePreset] = useState<'today' | 'tomorrow' | 'custom'>(() => {
    const today = startOfLocalDay(new Date());
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const initial = parseLocalDate(initialDateIsoLocal) ?? today;
    return resolveDatePreset(initial, today, tomorrow);
  });
  const [selectedStart, setSelectedStart] = useState<Date | null>(null);
  const [multiEnabled, setMultiEnabled] = useState(false);
  const [multiCount, setMultiCount] = useState<number>(MULTI_COUNTS[0]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const lastInitialRef = useRef<string | null>(null);

  const [todayDate, setTodayDate] = useState(() => startOfLocalDay(new Date()));
  const [tomorrowDate, setTomorrowDate] = useState(() => {
    const next = startOfLocalDay(new Date());
    next.setDate(next.getDate() + 1);
    return next;
  });

  const recomputeToday = useCallback(() => {
    const nextToday = startOfLocalDay(new Date());
    const nextTomorrow = new Date(nextToday);
    nextTomorrow.setDate(nextToday.getDate() + 1);
    setTodayDate(nextToday);
    setTomorrowDate(nextTomorrow);

    if (datePreset === 'today') {
      setSelectedDate(nextToday);
    }
    if (datePreset === 'tomorrow') {
      setSelectedDate(nextTomorrow);
    }
  }, [datePreset]);

  useFocusEffect(
    useCallback(() => {
      recomputeToday();
    }, [recomputeToday])
  );

  useEffect(() => {
    if (!initialDateIsoLocal || initialDateIsoLocal === lastInitialRef.current) {
      return;
    }
    const parsed = parseLocalDate(initialDateIsoLocal);
    if (!parsed) {
      return;
    }
    const today = startOfLocalDay(new Date());
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    setSelectedDate(parsed);
    setDatePreset(resolveDatePreset(parsed, today, tomorrow));
    lastInitialRef.current = initialDateIsoLocal;
  }, [initialDateIsoLocal]);

  const dateRange = useMemo(() => {
    const startLocal = startOfLocalDay(selectedDate);
    const endLocal = new Date(
      startLocal.getFullYear(),
      startLocal.getMonth(),
      startLocal.getDate(),
      23,
      59,
      59,
      999
    );
    return {
      fromUtc: startLocal.toISOString(),
      toUtc: endLocal.toISOString(),
    };
  }, [selectedDate]);

  useEffect(() => {
    setSelectedStart(null);
    setApiError(null);
  }, [selectedDate]);

  const slotsQuery = useAppQuery({
    queryKey: buildQueryKey(dateRange),
    queryFn: ({ signal }) => loadSlots(dateRange, { signal }),
  });

  const blockingSlots = useMemo(() => {
    return (slotsQuery.data ?? []).reduce<LocalSlotRange[]>((acc, slot) => {
      if (!slot.startsAtUtc) {
        return acc;
      }
      const start = new Date(slot.startsAtUtc);
      if (Number.isNaN(start.getTime())) {
        return acc;
      }
      const status = slot.status?.toLowerCase();
      if (status === 'cancelled') {
        return acc;
      }
      const duration = slot.durationMinutes ?? SLOT_DURATION_MINUTES;
      const end = new Date(start.getTime() + duration * 60 * 1000);
      acc.push({ startLocal: start, endLocal: end });
      return acc;
    }, []);
  }, [slotsQuery.data]);

  const grid = useMemo(
    () => buildTimeGrid(selectedDate, WORKDAY_START_HOUR, WORKDAY_END_HOUR, GRID_STEP_MINUTES),
    [selectedDate]
  );

  const baseDisabledTimes = useMemo(
    () => getDisabledStartTimes(grid, blockingSlots),
    [grid, blockingSlots]
  );

  const resolvedDisabledTimes = useMemo(() => {
    const disabled = new Set(baseDisabledTimes);
    if (slotsQuery.isLoading || slotsQuery.error) {
      grid.forEach((time) => disabled.add(time.getTime()));
      return disabled;
    }

    if (isSameLocalDay(selectedDate, new Date())) {
      const now = new Date();
      grid.forEach((time) => {
        if (time.getTime() <= now.getTime()) {
          disabled.add(time.getTime());
        }
      });
    }

    return disabled;
  }, [baseDisabledTimes, grid, selectedDate, slotsQuery.error, slotsQuery.isLoading]);

  const slotCount = multiEnabled ? multiCount : 1;

  const selectedRanges = useMemo(() => {
    if (!selectedStart) {
      return [];
    }
    return buildSequentialRanges(selectedStart, slotCount);
  }, [selectedStart, slotCount]);

  const selectionAvailable = useMemo(() => {
    if (!selectedRanges.length) {
      return false;
    }
    const now = new Date();
    return selectedRanges.every((range) => {
      if (isSameLocalDay(range.startLocal, now) && range.startLocal <= now) {
        return false;
      }
      if (!isRangeWithinWorkday(range)) {
        return false;
      }
      return isSlotRangeAvailable(
        range.startLocal,
        range.endLocal,
        blockingSlots
      );
    });
  }, [blockingSlots, selectedRanges]);

  const selectedRangeEnd = selectedRanges.length
    ? selectedRanges[selectedRanges.length - 1]?.endLocal ?? null
    : null;

  const selectedRangeLabel = useMemo(() => {
    if (!selectedStart || !selectedRangeEnd) {
      return null;
    }
    if (multiEnabled) {
      const ranges = selectedRanges
        .map((range) => formatTimeRangeRu(range.startLocal, range.endLocal))
        .filter(Boolean)
        .join(', ');
      return ranges
        ? t('createSlot.selectedMulti', { ranges })
        : null;
    }
    return t('createSlot.selectedSingle', {
      start: formatTimeLabel(selectedStart),
      end: formatTimeLabel(selectedRangeEnd),
      minutes: SLOT_DURATION_MINUTES,
    });
  }, [multiEnabled, selectedRangeEnd, selectedRanges, selectedStart]);

  const unavailableMultiMessage =
    multiEnabled && selectedStart && !selectionAvailable
      ? t('createSlot.multiUnavailable', { count: slotCount })
      : null;

  const canSubmit =
    !!selectedStart
    && selectionAvailable
    && !slotsQuery.isLoading
    && !slotsQuery.error;

  const handleDateChange = (event: DateTimePickerEvent, date?: Date) => {
    if (event.type === 'dismissed' && Platform.OS === 'android') {
      return;
    }

    if (date) {
      setSelectedDate(startOfLocalDay(date));
      setDatePreset('custom');
    }
  };

  const openDatePicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: selectedDate,
        mode: 'date',
        minimumDate: todayDate,
        onChange: handleDateChange,
      });
      return;
    }
    setPickerVisible(true);
  };

  const handleTilePress = (time: Date, isDisabled: boolean) => {
    if (isDisabled) {
      showToast({ type: 'info', title: t('createSlot.timeUnavailable') });
      return;
    }
    setApiError(null);
    setSelectedStart(time);
  };

  const createMutation = useAppMutation<number, Error, CreateSlotRequest[]>({
    mutationFn: async (payloads) => {
      let created = 0;
      for (const payload of payloads) {
        await createSlot(payload);
        created += 1;
      }
      return created;
    },
    onSuccess: (count) => {
      const title =
        count > 1 ? t('createSlot.successMulti', { count }) : t('createSlot.success');
      showToast({ type: 'success', title });
      setApiError(null);
      setSelectedStart(null);
      onAfterSuccess(count);
    },
    onError: (error) => {
      if (
        error instanceof TrainerSlotsOverlapError
        || (error instanceof ApiError && error.status === 409)
      ) {
        setApiError(t('createSlot.errorOverlap'));
        showToast({
          type: 'error',
          title: t('createSlot.errorTitle'),
          message: t('createSlot.errorOverlap'),
        });
        return;
      }

      if (error instanceof ApiTimeoutError || error.name === 'TypeError') {
        setApiError(t('createSlot.errorNetwork'));
        showToast({
          type: 'error',
          title: t('createSlot.errorTitle'),
          message: t('createSlot.errorNetwork'),
        });
        return;
      }

      const presented = presentApiError(error);
      setApiError(presented.message);
      showToast({
        type: 'error',
        title: presented.title,
        message: presented.message,
      });
    },
  });

  const handleCreate = async () => {
    if (!selectedStart || !selectionAvailable) {
      return;
    }

    const ranges = buildSequentialRanges(selectedStart, slotCount);
    const payloads = ranges.map((range) => ({
      startsAtUtc: range.startLocal.toISOString(),
      durationMinutes: SLOT_DURATION_MINUTES,
    }));

    try {
      await createMutation.mutateAsync(payloads);
    } catch {
      // handled in mutation callbacks
    }
  };

  return {
    datePreset,
    setDatePreset,
    selectedDate,
    setSelectedDate,
    selectedStart,
    selectedRangeEnd,
    selectedRangeLabel,
    unavailableMultiMessage,
    canSubmit,
    handleCreate,
    handleTilePress,
    grid,
    resolvedDisabledTimes,
    slotsQuery,
    apiError,
    multiEnabled,
    setMultiEnabled,
    multiCount,
    setMultiCount,
    slotCount,
    pickerVisible,
    setPickerVisible,
    handleDateChange,
    openDatePicker,
    todayDate,
    tomorrowDate,
    isCreating: createMutation.isPending,
  };
};
