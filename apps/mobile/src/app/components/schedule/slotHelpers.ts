import type { SlotDto } from '../../../generated/api';

export type SlotStatusType = 'available' | 'booked' | 'cancelled';

const normalize = (value?: string | null) => value?.toLowerCase().trim();

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

export const getClientName = (slot: SlotDto): string | null => {
  const candidate = slot.clientName;
  return candidate ? candidate : null;
};

export const getClientAvatarUrl = (slot: SlotDto): string | null => {
  const candidate = slot.clientAvatarUrl;
  return candidate ? candidate : null;
};
