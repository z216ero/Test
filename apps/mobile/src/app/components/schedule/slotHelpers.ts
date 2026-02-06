import type { SlotDto } from '@generated/api';
import type { TranslationKey } from '@i18n';

export type UiSlotStatus =
  | 'available'
  | 'booked'
  | 'needs_attention'
  | 'completed'
  | 'no_show'
  | 'cancelled';

export type UiSlotStatusMeta = {
  labelKey: TranslationKey;
  dotColor: string;
  labelColor: string;
  borderColor?: string;
  backgroundColor?: string;
};

const WARNING_COLOR = '#F59E0B';
const WARNING_TINT = '#FFFBEB';
const SUCCESS_STRONG = '#16A34A';

export const uiSlotStatusMeta: Record<UiSlotStatus, UiSlotStatusMeta> = {
  available: {
    labelKey: 'schedule.status.available',
    dotColor: '$accent',
    labelColor: '$text',
  },
  booked: {
    labelKey: 'schedule.status.booked',
    dotColor: '$primary',
    labelColor: '$text',
  },
  needs_attention: {
    labelKey: 'schedule.status.needsAttention',
    dotColor: WARNING_COLOR,
    labelColor: WARNING_COLOR,
    borderColor: WARNING_COLOR,
    backgroundColor: WARNING_TINT,
  },
  completed: {
    labelKey: 'schedule.status.completed',
    dotColor: SUCCESS_STRONG,
    labelColor: SUCCESS_STRONG,
  },
  no_show: {
    labelKey: 'schedule.status.noShow',
    dotColor: '$danger',
    labelColor: '$danger',
  },
  cancelled: {
    labelKey: 'schedule.status.cancelled',
    dotColor: '$muted',
    labelColor: '$muted',
  },
};

const normalize = (value?: string | null) => value?.toLowerCase().trim();

const isNoShowStatus = (value?: string | null): boolean => {
  const normalized = normalize(value);
  return normalized === 'noshow'
    || normalized === 'no_show'
    || normalized === 'no-show';
};

const hasClient = (slot: SlotDto): boolean => {
  const name = slot.clientName?.trim();
  return Boolean(name);
};

const isBookingStatus = (value?: string | null, expected?: string) =>
  normalize(value) === expected?.toLowerCase();

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

export const getSlotEndTimestamp = (slot: SlotDto): number | null => {
  const startTs = getStartTimestamp(slot);
  if (startTs === null) {
    return null;
  }
  const duration = slot.durationMinutes ?? 0;
  return startTs + duration * 60 * 1000;
};

export const isAttendanceFinalStatus = (slot: SlotDto): boolean => {
  const bookingStatus = normalize(slot.bookingStatus);
  const status = normalize(slot.status);
  return status === 'cancelled'
    || bookingStatus === 'cancelled'
    || bookingStatus === 'completed'
    || isNoShowStatus(bookingStatus);
};

export const getSlotTimes = (slot: SlotDto) => {
  const startTs = getStartTimestamp(slot);
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

export const getUiSlotStatus = (slot: SlotDto, nowTs: number): UiSlotStatus => {
  const bookingStatus = normalize(slot.bookingStatus);
  const status = normalize(slot.status);

  if (status === 'cancelled' || bookingStatus === 'cancelled') {
    return 'cancelled';
  }

  if (bookingStatus === 'completed') {
    return 'completed';
  }

  if (isNoShowStatus(bookingStatus)) {
    return 'no_show';
  }

  if (status === 'booked') {
    if (bookingStatus === 'booked') {
      const startTs = getStartTimestamp(slot);
      if (startTs !== null) {
        const endTs = getSlotEndTimestamp(slot) ?? startTs;
        if (
          nowTs >= startTs + NO_SHOW_AVAILABLE_AFTER_MS
          || nowTs >= endTs
        ) {
          return 'needs_attention';
        }
      }
    }
    return 'booked';
  }

  if (status === 'available' || status === 'open') {
    return 'available';
  }

  return 'available';
};

export const isUiSlotStatusFinal = (status: UiSlotStatus): boolean =>
  status === 'completed' || status === 'no_show' || status === 'cancelled';

export const isFreeSlotPast = (slot: SlotDto, nowTs: number): boolean => {
  if (getUiSlotStatus(slot, nowTs) !== 'available') {
    return false;
  }
  const startTs = getStartTimestamp(slot);
  if (startTs === null) {
    return false;
  }
  return nowTs > startTs + FREE_SLOT_PAST_GRACE_MS;
};

export const canMarkNoShow = (slot: SlotDto, nowTs: number): boolean => {
  const status = getUiSlotStatus(slot, nowTs);
  if (status === 'needs_attention') {
    return true;
  }
  if (status !== 'booked') {
    return false;
  }
  const startTs = getStartTimestamp(slot);
  if (startTs === null) {
    return false;
  }
  return nowTs >= startTs + NO_SHOW_AVAILABLE_AFTER_MS;
};

export const canMarkCompleted = (slot: SlotDto, nowTs: number): boolean => {
  const status = getUiSlotStatus(slot, nowTs);
  if (status !== 'booked' && status !== 'needs_attention') {
    return false;
  }
  const startTs = getStartTimestamp(slot);
  if (startTs === null) {
    return false;
  }
  return nowTs >= startTs;
};

const isSlotAvailable = (slot: SlotDto): boolean => {
  const status = normalize(slot.status);
  return status === 'available' || status === 'open';
};

const isSlotBooked = (slot: SlotDto): boolean => normalize(slot.status) === 'booked';

export const canCancelSlot = (slot: SlotDto, nowTs: number): boolean => {
  if (!isSlotAvailable(slot)) {
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

export const canCancelBookedSlot = (slot: SlotDto, _nowTs: number): boolean => {
  if (!isSlotBooked(slot)) {
    return false;
  }
  if (isAttendanceFinalStatus(slot)) {
    return false;
  }
  return true;
};

export const isActiveSlotForMainList = (slot: SlotDto, nowTs: number): boolean => {
  const status = getUiSlotStatus(slot, nowTs);
  if (isUiSlotStatusFinal(status)) {
    return false;
  }
  if (status === 'available') {
    return !isFreeSlotPast(slot, nowTs);
  }
  if (status === 'booked' || status === 'needs_attention') {
    return true;
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

export const shouldShowInCompletedToday = (slot: SlotDto): boolean => {
  const bookingStatus = normalize(slot.bookingStatus);
  if (bookingStatus === 'completed') {
    return true;
  }
  if (isNoShowStatus(bookingStatus)) {
    return true;
  }
  if (isBookingStatus(bookingStatus, 'cancelled') && hasClient(slot)) {
    return true;
  }
  return false;
};


