import { useFocusEffect } from '@react-navigation/native';
import {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { addDays, isSameLocalDay, startOfLocalDay } from '@utils/localDate';

const FUTURE_DATE_RANGE_DAYS = 14;
const PAST_DATE_RANGE_DAYS = 14;

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

type UseScheduleDateStateArgs = {
  initialDateIsoLocal?: string;
};

export function useScheduleDateState({
  initialDateIsoLocal,
}: UseScheduleDateStateArgs) {
  const [selectedDate, setSelectedDate] = useState(() =>
    resolveInitialSelectedDate(initialDateIsoLocal)
  );
  const [todayDate, setTodayDate] = useState(() => startOfLocalDay(new Date()));
  const [tomorrowDate, setTomorrowDate] = useState(() => addDays(startOfLocalDay(new Date()), 1));
  const [pickerVisible, setPickerVisible] = useState(false);
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

  useFocusEffect(
    useCallback(() => {
      const nextToday = startOfLocalDay(new Date());
      const nextTomorrow = addDays(nextToday, 1);
      setTodayDate((prev) => (isSameLocalDay(prev, nextToday) ? prev : nextToday));
      setTomorrowDate((prev) => (isSameLocalDay(prev, nextTomorrow) ? prev : nextTomorrow));
      setSelectedDate((current) =>
        isSameLocalDay(current, todayRef.current) ? nextToday : current
      );
    }, [])
  );

  const minDate = useMemo(() => addDays(todayDate, -PAST_DATE_RANGE_DAYS), [todayDate]);
  const maxDate = useMemo(() => addDays(todayDate, FUTURE_DATE_RANGE_DAYS), [todayDate]);

  const visibleDates = useMemo(() =>
    Array.from({ length: PAST_DATE_RANGE_DAYS + FUTURE_DATE_RANGE_DAYS + 1 }).map((_, index) =>
      addDays(minDate, index)
    ), [minDate]
  );

  const isSelectedToday = isSameLocalDay(selectedDate, todayDate);
  const isPastDay = selectedDate.getTime() < todayDate.getTime();
  const canCreateSlot = selectedDate.getTime() >= todayDate.getTime();

  const handleSelectDate = useCallback((value: Date) => {
    setSelectedDate(startOfLocalDay(value));
  }, []);

  const handleDateChange = useCallback((event: DateTimePickerEvent, date?: Date) => {
    if (event.type === 'dismissed' && Platform.OS === 'android') {
      return;
    }
    if (date) {
      handleSelectDate(date);
    }
  }, [handleSelectDate]);

  const openDatePicker = useCallback(() => {
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
  }, [handleDateChange, maxDate, minDate, selectedDate]);

  return {
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
  };
}
