const toDate = (value: string | Date): Date | null => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
};

const formatTime = (value: string | Date): string => {
  const date = toDate(value);
  if (!date) {
    return '';
  }

  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
};

export const formatDateRu = (value: string | Date): string => {
  const date = toDate(value);
  if (!date) {
    return '';
  }

  const raw = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
  }).format(date);

  return raw.replace('.', '');
};

export const formatDateWithWeekdayRu = (value: string | Date): string => {
  const date = toDate(value);
  if (!date) {
    return '';
  }

  const parts = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    weekday: 'short',
  }).formatToParts(date);

  const day = parts.find((part) => part.type === 'day')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const weekdayRaw = parts.find((part) => part.type === 'weekday')?.value;
  if (!day || !month) {
    return '';
  }

  const cleanedWeekday = weekdayRaw?.replace('.', '') ?? '';
  const weekday = cleanedWeekday
    ? cleanedWeekday.charAt(0).toUpperCase() + cleanedWeekday.slice(1)
    : '';

  return weekday ? `${day} ${month}, ${weekday}` : `${day} ${month}`;
};

export const formatTimeRangeRu = (
  start: string | Date,
  end: string | Date
): string => {
  const startLabel = formatTime(start);
  if (!startLabel) {
    return '';
  }

  const endLabel = formatTime(end);
  if (!endLabel) {
    return startLabel;
  }

  if (startLabel === endLabel) {
    return startLabel;
  }

  return `${startLabel}\u2013${endLabel}`;
};
