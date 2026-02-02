export const SLOT_DURATION_MINUTES = 60;
export const GRID_STEP_MINUTES = 30;
export const WORKDAY_START_HOUR = 6;
export const WORKDAY_END_HOUR = 22;

export type LocalSlotRange = {
  startLocal: Date;
  endLocal: Date;
};

export const buildTimeGrid = (
  dateLocal: Date,
  startHour: number = WORKDAY_START_HOUR,
  endHour: number = WORKDAY_END_HOUR,
  stepMinutes: number = GRID_STEP_MINUTES
): Date[] => {
  const grid: Date[] = [];
  const base = new Date(
    dateLocal.getFullYear(),
    dateLocal.getMonth(),
    dateLocal.getDate(),
    startHour,
    0,
    0,
    0
  );
  const end = new Date(
    dateLocal.getFullYear(),
    dateLocal.getMonth(),
    dateLocal.getDate(),
    endHour,
    0,
    0,
    0
  );

  let cursor = new Date(base);
  while (cursor.getTime() <= end.getTime()) {
    grid.push(new Date(cursor));
    cursor = new Date(cursor.getTime() + stepMinutes * 60 * 1000);
  }

  return grid;
};

export const computeRange = (
  startLocal: Date,
  durationMinutes: number = SLOT_DURATION_MINUTES
): LocalSlotRange => {
  const endLocal = new Date(startLocal.getTime() + durationMinutes * 60 * 1000);
  return { startLocal, endLocal };
};

export const overlaps = (
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date
): boolean => aStart < bEnd && bStart < aEnd;

export const isSlotRangeAvailable = (
  candidateStart: Date,
  candidateEnd: Date,
  existingSlots: LocalSlotRange[]
): boolean =>
  !existingSlots.some((slot) =>
    overlaps(candidateStart, candidateEnd, slot.startLocal, slot.endLocal)
  );

const isSameLocalDay = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear()
  && left.getMonth() === right.getMonth()
  && left.getDate() === right.getDate();

const isWithinWorkday = (startLocal: Date, endLocal: Date) => {
  const workdayStart = new Date(
    startLocal.getFullYear(),
    startLocal.getMonth(),
    startLocal.getDate(),
    WORKDAY_START_HOUR,
    0,
    0,
    0
  );
  const workdayEnd = new Date(
    startLocal.getFullYear(),
    startLocal.getMonth(),
    startLocal.getDate(),
    WORKDAY_END_HOUR,
    0,
    0,
    0
  );
  return startLocal >= workdayStart && endLocal <= workdayEnd;
};

export const getDisabledStartTimes = (
  grid: Date[],
  existingSlots: LocalSlotRange[]
): Set<number> => {
  const disabled = new Set<number>();

  grid.forEach((candidateStart) => {
    const { endLocal } = computeRange(candidateStart, SLOT_DURATION_MINUTES);
    const endOfDay = new Date(
      candidateStart.getFullYear(),
      candidateStart.getMonth(),
      candidateStart.getDate(),
      23,
      59,
      59,
      999
    );

    const withinDay = isSameLocalDay(candidateStart, endLocal)
      && endLocal.getTime() <= endOfDay.getTime();
    const withinWorkday = isWithinWorkday(candidateStart, endLocal);
    const available = isSlotRangeAvailable(
      candidateStart,
      endLocal,
      existingSlots
    );

    if (!withinDay || !withinWorkday || !available) {
      disabled.add(candidateStart.getTime());
    }
  });

  return disabled;
};
