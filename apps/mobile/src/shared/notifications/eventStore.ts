import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatTimeRangeRu } from '@utils/datetime';

export type NotificationEvent = {
  id: string;
  type: string;
  occurredAtUtc: string;
  slotId: string;
  slotStartsAtUtc?: string;
  slotDurationMinutes?: number;
  actorName?: string;
  actorRole?: 'Client' | 'Trainer';
  trainerName?: string;
  clientName?: string;
  cancellationReason?: string;
  title: string;
  description: string;
  isRead: boolean;
  createdAtLocalTs: number;
};

export type NotificationEventInput = {
  id?: string;
  type?: string;
  occurredAtUtc?: string;
  slotId?: string;
  slotStartsAtUtc?: string;
  slotDurationMinutes?: number;
  actorName?: string;
  actorRole?: 'Client' | 'Trainer';
  trainerName?: string;
  clientName?: string;
  cancellationReason?: string;
};

const STORAGE_KEY = 'notification_events_v1';
const MAX_EVENTS = 50;
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const FALLBACK_DEDUP_WINDOW_MS = 60 * 1000;

const toDate = (value?: string): Date | null => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const buildSlotTimeRange = (
  slotStartsAtUtc?: string,
  slotDurationMinutes?: number
): string => {
  const startDate = toDate(slotStartsAtUtc);
  if (!startDate) {
    return '';
  }
  const duration = slotDurationMinutes ?? 0;
  const endDate = duration > 0
    ? new Date(startDate.getTime() + duration * 60 * 1000)
    : startDate;
  return formatTimeRangeRu(startDate, endDate);
};

export const buildEventText = (input: NotificationEventInput): {
  title: string;
  description: string;
} => {
  const slotTimeRange = buildSlotTimeRange(
    input.slotStartsAtUtc,
    input.slotDurationMinutes
  );
  const withTime = (text: string) =>
    slotTimeRange ? `${text} на ${slotTimeRange}` : text;

  switch (input.type) {
    case 'booking_created': {
      const name = input.clientName ?? input.actorName ?? 'Клиент';
      return {
        title: 'Новая запись',
        description: withTime(`${name} записался`),
      };
    }
    case 'booking_cancelled': {
      const name = input.clientName ?? input.actorName ?? 'Клиент';
      return {
        title: 'Отмена записи',
        description: withTime(`${name} отменил тренировку`),
      };
    }
    case 'slot_cancelled_by_trainer': {
      if (input.cancellationReason === 'min_participants_not_reached') {
        return {
          title: 'Групповая тренировка отменена',
          description: withTime('Не набралось минимальное количество участников'),
        };
      }

      const name = input.trainerName ?? input.actorName ?? 'Тренер';
      return {
        title: 'Тренировка отменена',
        description: withTime(`${name} отменил тренировку`),
      };
    }
    case 'attendance_marked': {
      const base = 'Тренер отметил: статус обновлён';
      const description = slotTimeRange ? `${base} (${slotTimeRange})` : base;
      return {
        title: 'Статус тренировки обновлён',
        description,
      };
    }
    default: {
      const description = slotTimeRange
        ? `Есть обновление (${slotTimeRange})`
        : 'Есть обновление';
      return { title: 'Обновление', description };
    }
  }
};

const loadEvents = async (): Promise<NotificationEvent[]> => {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as NotificationEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveEvents = async (events: NotificationEvent[]): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(events));
};

const cleanupEvents = (events: NotificationEvent[]): NotificationEvent[] => {
  const now = Date.now();
  return events.filter((event) => now - event.createdAtLocalTs <= TTL_MS);
};

const normalizeEvents = (events: NotificationEvent[]): NotificationEvent[] =>
  cleanupEvents(events)
    .sort((a, b) => b.createdAtLocalTs - a.createdAtLocalTs)
    .slice(0, MAX_EVENTS);

const dedupeFallback = (
  events: NotificationEvent[],
  input: NotificationEventInput
): boolean => {
  if (!input.type || !input.slotId || !input.occurredAtUtc) {
    return false;
  }

  const occurredAt = toDate(input.occurredAtUtc);
  if (!occurredAt) {
    return false;
  }

  return events.some((event) => {
    if (event.type !== input.type || event.slotId !== input.slotId) {
      return false;
    }
    const eventOccurred = toDate(event.occurredAtUtc);
    if (!eventOccurred) {
      return false;
    }
    return Math.abs(eventOccurred.getTime() - occurredAt.getTime()) <= FALLBACK_DEDUP_WINDOW_MS;
  });
};

export const listEvents = async (): Promise<NotificationEvent[]> => {
  const existing = await loadEvents();
  const cleaned = normalizeEvents(existing);
  if (cleaned.length !== existing.length) {
    await saveEvents(cleaned);
  }
  return cleaned;
};

export const appendEvent = async (
  input: NotificationEventInput
): Promise<NotificationEvent[]> => {
  if (!input.type || !input.slotId) {
    return listEvents();
  }

  const existing = await loadEvents();
  if (input.id && existing.some((event) => event.id === input.id)) {
    return normalizeEvents(existing);
  }

  if (!input.id && dedupeFallback(existing, input)) {
    return normalizeEvents(existing);
  }

  const occurredAtUtc = input.occurredAtUtc ?? new Date().toISOString();
  const { title, description } = buildEventText(input);

  const nextEvent: NotificationEvent = {
    id: input.id ?? `${input.type}-${input.slotId}-${occurredAtUtc}`,
    type: input.type,
    occurredAtUtc,
    slotId: input.slotId,
    slotStartsAtUtc: input.slotStartsAtUtc,
    slotDurationMinutes: input.slotDurationMinutes,
    actorName: input.actorName,
    actorRole: input.actorRole,
    trainerName: input.trainerName,
    clientName: input.clientName,
    cancellationReason: input.cancellationReason,
    title,
    description,
    isRead: false,
    createdAtLocalTs: Date.now(),
  };

  const updated = normalizeEvents([nextEvent, ...existing]);
  await saveEvents(updated);
  return updated;
};

export const markEventRead = async (eventId: string): Promise<NotificationEvent[]> => {
  const existing = await loadEvents();
  let changed = false;
  const updated = existing.map((event) => {
    if (event.id !== eventId || event.isRead) {
      return event;
    }
    changed = true;
    return { ...event, isRead: true };
  });

  if (!changed) {
    return normalizeEvents(existing);
  }

  const normalized = normalizeEvents(updated);
  await saveEvents(normalized);
  return normalized;
};

export const markAllEventsRead = async (): Promise<NotificationEvent[]> => {
  const existing = await loadEvents();
  const updated = existing.map((event) => ({ ...event, isRead: true }));
  const normalized = normalizeEvents(updated);
  await saveEvents(normalized);
  return normalized;
};

export const clearEvents = async (): Promise<void> => {
  await AsyncStorage.removeItem(STORAGE_KEY);
};
