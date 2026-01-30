import AsyncStorage from '@react-native-async-storage/async-storage';

export type InAppEventType = 'BOOKED' | 'CANCELLED';

export type InAppEvent = {
  id: string;
  type: InAppEventType;
  message: string;
  occurredAtUtcIso: string;
};

const STORAGE_KEY = 'notifications.inAppLog.v1';
const MAX_EVENTS = 50;

const loadEvents = async (): Promise<InAppEvent[]> => {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as InAppEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveEvents = async (events: InAppEvent[]): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(events));
};

export const appendEvent = async (event: Omit<InAppEvent, 'id' | 'occurredAtUtcIso'> & Partial<Pick<InAppEvent, 'id' | 'occurredAtUtcIso'>>): Promise<void> => {
  const existing = await loadEvents();
  const next: InAppEvent = {
    id: event.id ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type: event.type,
    message: event.message,
    occurredAtUtcIso: event.occurredAtUtcIso ?? new Date().toISOString(),
  };
  const updated = [next, ...existing].slice(0, MAX_EVENTS);
  await saveEvents(updated);
};

export const listEvents = async (): Promise<InAppEvent[]> => loadEvents();

export const clearEvents = async (): Promise<void> => {
  await AsyncStorage.removeItem(STORAGE_KEY);
};
