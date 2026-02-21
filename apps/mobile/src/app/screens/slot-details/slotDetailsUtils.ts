import type { SlotAttendeeDto, SlotDto } from '@generated/api';
import { t } from '@i18n';

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

export const getStatusLabel = (status?: string | null) => {
  if (!status) {
    return t('common.empty');
  }

  switch (status.toLowerCase()) {
    case 'open':
    case 'available':
      return t('status.open');
    case 'booked':
      return t('status.booked');
    case 'cancelled':
      return t('status.cancelled');
    case 'completed':
      return t('status.completed');
    case 'noshow':
    case 'no_show':
    case 'no-show':
      return t('status.noShow');
    default:
      return status;
  }
};

const normalize = (value?: string | null) => value?.toLowerCase().trim();

export const isGroupSlot = (slot: SlotDto) => normalize(slot.slotType) === 'group';
export const isCancelledAttendee = (attendee: SlotAttendeeDto) => normalize(attendee.status) === 'cancelled';

