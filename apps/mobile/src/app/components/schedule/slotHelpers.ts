import type { SlotDto } from '../../../generated/api';

export type SlotStatusType = 'available' | 'booked' | 'cancelled';

const normalize = (value?: string | null) => value?.toLowerCase().trim();

export const FREE_SLOT_PAST_GRACE_MS = 1 * 60 * 1000;
export const NO_SHOW_AVAILABLE_AFTER_MS = 15 * 60 * 1000;
export const CANCEL_FORBIDDEN_WITHIN_MS = 30 * 60 * 1000;

const getStartTimestamp = (slot: SlotDto): number | null => {
  if (!slot.startsAtUtc) {
    return null;
  }
  const timestamp = new Date(slot.startsAtUtc).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
};

export const getSlotStartTimestamp = (slot: SlotDto): number | null =>
  getStartTimestamp(slot);

export const isAttendanceFinalStatus = (slot: SlotDto): boolean => {
  const bookingStatus = normalize(slot.bookingStatus);
  return (
    bookingStatus === 'completed'
    || bookingStatus === 'noshow'
    || bookingStatus === 'no_show'
    || bookingStatus === 'no-show'
  );
};

export const getSlotTimes = (slot: SlotDto) => {
  if (!slot.startsAtUtc) {
    return null;
  }
  const start = new Date(slot.startsAtUtc);
  if (Number.isNaN(start.getTime())) {
    return null;
  }
  const duration = slot.durationMinutes ?? 0;
  const end = duration
    ? new Date(start.getTime() + duration * 60 * 1000)
    : start;
  return { start, end };
};

export const getSlotStatusType = (slot: SlotDto): SlotStatusType => {
  const bookingStatus = normalize(slot.bookingStatus);
  const status = normalize(slot.status);

  if (bookingStatus === 'cancelled' || status === 'cancelled') {
    return 'cancelled';
  }

  if (
    bookingStatus === 'booked'
    || bookingStatus === 'completed'
    || bookingStatus === 'noshow'
    || bookingStatus === 'no_show'
    || bookingStatus === 'no-show'
  ) {
    return 'booked';
  }

  if (status === 'booked') {
    return 'booked';
  }

  if (status === 'available' || status === 'open') {
    return 'available';
  }

  return 'available';
};

export const isFreeSlotPast = (slot: SlotDto, nowTs: number): boolean => {
  if (getSlotStatusType(slot) !== 'available') {
    return false;
  }
  const startTs = getStartTimestamp(slot);
  if (startTs === null) {
    return false;
  }
  return nowTs > startTs + FREE_SLOT_PAST_GRACE_MS;
};

export const canMarkNoShow = (slot: SlotDto, nowTs: number): boolean => {
  if (getSlotStatusType(slot) !== 'booked') {
    return false;
  }
  if (isAttendanceFinalStatus(slot)) {
    return false;
  }
  const startTs = getStartTimestamp(slot);
  if (startTs === null) {
    return false;
  }
  return nowTs >= startTs + NO_SHOW_AVAILABLE_AFTER_MS;
};

export const canMarkCompleted = (slot: SlotDto, nowTs: number): boolean => {
  if (getSlotStatusType(slot) !== 'booked') {
    return false;
  }
  if (isAttendanceFinalStatus(slot)) {
    return false;
  }
  const startTs = getStartTimestamp(slot);
  if (startTs === null) {
    return false;
  }
  return nowTs >= startTs;
};

export const canCancelSlot = (slot: SlotDto, nowTs: number): boolean => {
  if (getSlotStatusType(slot) !== 'available') {
    return false;
  }
  const startTs = getStartTimestamp(slot);
  if (startTs === null) {
    return false;
  }
  if (isFreeSlotPast(slot, nowTs)) {
    return false;
  }
  return nowTs < startTs - CANCEL_FORBIDDEN_WITHIN_MS
    && nowTs <= startTs + FREE_SLOT_PAST_GRACE_MS;
};

export const canCancelBookedSlot = (slot: SlotDto, nowTs: number): boolean => {
  if (getSlotStatusType(slot) !== 'booked') {
    return false;
  }
  if (isAttendanceFinalStatus(slot)) {
    return false;
  }
  return true;
};

export const isActiveSlotForMainList = (slot: SlotDto, nowTs: number): boolean => {
  const statusType = getSlotStatusType(slot);
  if (statusType === 'cancelled') {
    return false;
  }
  if (statusType === 'available') {
    return !isFreeSlotPast(slot, nowTs);
  }
  if (statusType === 'booked') {
    return !isAttendanceFinalStatus(slot);
  }
  return true;
};

export const getClientName = (slot: SlotDto): string | null => {
  const candidate = slot.clientName;
  return candidate ? candidate : null;
};

export const getClientAvatarUrl = (slot: SlotDto): string | null => {
  const candidate = slot.clientAvatarUrl;
  return candidate ? candidate : null;
};
