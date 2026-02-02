const toLocalDate = (utcIso: string): Date | null => {
  const date = new Date(utcIso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
};

export const formatUtcRange = (
  utcStart: string,
  durationMinutes: number
): { start: string; end: string } => {
  const startDate = toLocalDate(utcStart);
  if (!startDate) {
    return { start: utcStart, end: 'Invalid date' };
  }

  const endDate = new Date(
    startDate.getTime() + durationMinutes * 60 * 1000
  );
  return {
    start: startDate.toLocaleString(),
    end: endDate.toLocaleString(),
  };
};

export const parseLocalDateTime = (value: string): Date | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.includes('T')
    ? trimmed
    : trimmed.replace(' ', 'T');
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
};
