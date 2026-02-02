import type { SlotDto } from '../../../generated/api';
import type { TranslationKey } from '../../../i18n';

export type BookingStatusType =
  | 'booked'
  | 'completed'
  | 'no_show'
  | 'cancelled'
  | 'unknown';

export type BookingStatusMeta = {
  labelKey: TranslationKey;
  color: string;
};

const normalize = (value?: string | null) => value?.toLowerCase().trim();

const isNoShow = (value?: string | null): boolean => {
  const normalized = normalize(value);
  return normalized === 'noshow'
    || normalized === 'no_show'
    || normalized === 'no-show';
};

export const getBookingStatusType = (slot: SlotDto): BookingStatusType => {
  const status = normalize(slot.bookingStatus ?? slot.status);
  if (!status) {
    return 'unknown';
  }
  if (status === 'booked') {
    return 'booked';
  }
  if (status === 'completed') {
    return 'completed';
  }
  if (isNoShow(status)) {
    return 'no_show';
  }
  if (status === 'cancelled') {
    return 'cancelled';
  }
  return 'unknown';
};

export const bookingStatusMeta: Record<BookingStatusType, BookingStatusMeta> = {
  booked: {
    labelKey: 'bookings.statusBooked',
    color: '$accent',
  },
  completed: {
    labelKey: 'bookings.statusCompleted',
    color: '$accent',
  },
  no_show: {
    labelKey: 'bookings.statusNoShow',
    color: '$danger',
  },
  cancelled: {
    labelKey: 'bookings.statusCancelledByTrainer',
    color: '$muted',
  },
  unknown: {
    labelKey: 'bookings.statusUnknown',
    color: '$muted',
  },
};

export const getSlotStartTimestamp = (slot: SlotDto): number | null => {
  if (!slot.startsAtUtc) {
    return null;
  }
  const start = new Date(slot.startsAtUtc).getTime();
  return Number.isNaN(start) ? null : start;
};

export const getSlotTimes = (slot: SlotDto): { start: Date; end: Date } | null => {
  const startTs = getSlotStartTimestamp(slot);
  if (startTs === null) {
    return null;
  }
  const start = new Date(startTs);
  const duration = slot.durationMinutes ?? 0;
  const end = duration
    ? new Date(startTs + duration * 60 * 1000)
    : start;
  return { start, end };
};

export const isUpcomingBooking = (slot: SlotDto, nowTs: number): boolean => {
  const status = getBookingStatusType(slot);
  if (status !== 'booked') {
    return false;
  }
  const startTs = getSlotStartTimestamp(slot);
  if (startTs === null) {
    return false;
  }
  return startTs > nowTs;
};

export const isHistoryBooking = (slot: SlotDto): boolean => {
  const status = getBookingStatusType(slot);
  return status === 'completed' || status === 'no_show' || status === 'cancelled';
};

export const canCancelBooking = (slot: SlotDto, nowTs: number): boolean => {
  if (getBookingStatusType(slot) !== 'booked') {
    return false;
  }
  const startTs = getSlotStartTimestamp(slot);
  if (startTs === null) {
    return false;
  }
  return nowTs < startTs;
};
