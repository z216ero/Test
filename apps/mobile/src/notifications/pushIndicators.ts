import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

export type ScheduleBadgeState = {
  hasUnread: boolean;
  updatedAt: number;
};

export type SlotHighlightType = 'booking_created' | 'booking_cancelled';
export type SlotHighlightColor = 'success' | 'destructive';

export type SlotHighlight = {
  eventId: string;
  type: SlotHighlightType;
  color: SlotHighlightColor;
  chipText: string;
  createdAt: number;
  seen: boolean;
};

export type PushIndicatorsState = {
  scheduleBadge: ScheduleBadgeState;
  slotHighlights: Record<string, SlotHighlight>;
  recentEventIds: Record<string, number>;
};

const STORAGE_KEY = 'notifications.pushIndicators.v1';
const HIGHLIGHT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const EVENT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_RECENT_EVENTS = 100;

const DEFAULT_STATE: PushIndicatorsState = {
  scheduleBadge: { hasUnread: false, updatedAt: 0 },
  slotHighlights: {},
  recentEventIds: {},
};

let cachedState: PushIndicatorsState | null = null;
const listeners = new Set<() => void>();

const notify = () => {
  listeners.forEach((listener) => listener());
};

const coerceState = (value: Partial<PushIndicatorsState> | null): PushIndicatorsState => ({
  scheduleBadge: {
    hasUnread: value?.scheduleBadge?.hasUnread ?? DEFAULT_STATE.scheduleBadge.hasUnread,
    updatedAt: value?.scheduleBadge?.updatedAt ?? DEFAULT_STATE.scheduleBadge.updatedAt,
  },
  slotHighlights: value?.slotHighlights ?? DEFAULT_STATE.slotHighlights,
  recentEventIds: value?.recentEventIds ?? DEFAULT_STATE.recentEventIds,
});

const cleanupState = (state: PushIndicatorsState): PushIndicatorsState => {
  const now = Date.now();
  const slotHighlights = Object.fromEntries(
    Object.entries(state.slotHighlights).filter(([, highlight]) =>
      now - highlight.createdAt <= HIGHLIGHT_TTL_MS
    )
  );

  const recentEntries = Object.entries(state.recentEventIds)
    .filter(([, createdAt]) => now - createdAt <= EVENT_TTL_MS)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_RECENT_EVENTS);

  const recentEventIds = Object.fromEntries(recentEntries);

  return {
    scheduleBadge: state.scheduleBadge,
    slotHighlights,
    recentEventIds,
  };
};

const loadState = async (): Promise<PushIndicatorsState> => {
  if (cachedState) {
    return cachedState;
  }

  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    cachedState = DEFAULT_STATE;
    return cachedState;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PushIndicatorsState>;
    cachedState = cleanupState(coerceState(parsed));
    return cachedState;
  } catch {
    cachedState = DEFAULT_STATE;
    return cachedState;
  }
};

const persistState = async (state: PushIndicatorsState): Promise<void> => {
  cachedState = state;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  notify();
};

const updateState = async (
  updater: (state: PushIndicatorsState) => PushIndicatorsState
): Promise<PushIndicatorsState> => {
  const current = await loadState();
  const next = cleanupState(updater(current));
  await persistState(next);
  return next;
};

export const hydratePushIndicators = async (): Promise<PushIndicatorsState> => {
  const state = await loadState();
  const next = cleanupState(state);
  if (next !== state) {
    await persistState(next);
  } else {
    notify();
  }
  return next;
};

export const subscribePushIndicators = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getPushIndicatorsSnapshot = (): PushIndicatorsState =>
  cachedState ?? DEFAULT_STATE;

export const setScheduleBadgeUnread = async (): Promise<void> => {
  await updateState((state) => ({
    ...state,
    scheduleBadge: { hasUnread: true, updatedAt: Date.now() },
  }));
};

export const clearScheduleBadge = async (): Promise<void> => {
  await updateState((state) => ({
    ...state,
    scheduleBadge: { hasUnread: false, updatedAt: Date.now() },
  }));
};

export const upsertSlotHighlight = async (
  slotId: string,
  highlight: SlotHighlight
): Promise<void> => {
  await updateState((state) => ({
    ...state,
    slotHighlights: {
      ...state.slotHighlights,
      [slotId]: highlight,
    },
  }));
};

export const markSlotHighlightSeen = async (slotId: string): Promise<void> => {
  await updateState((state) => {
    const current = state.slotHighlights[slotId];
    if (!current || current.seen) {
      return state;
    }
    return {
      ...state,
      slotHighlights: {
        ...state.slotHighlights,
        [slotId]: { ...current, seen: true },
      },
    };
  });
};

export const markPushEventProcessed = async (eventId: string): Promise<boolean> => {
  const current = await loadState();
  if (current.recentEventIds[eventId]) {
    return true;
  }

  await updateState((state) => ({
    ...state,
    recentEventIds: {
      ...state.recentEventIds,
      [eventId]: Date.now(),
    },
  }));
  return false;
};

export const clearPushIndicators = async (): Promise<void> => {
  cachedState = DEFAULT_STATE;
  await AsyncStorage.removeItem(STORAGE_KEY);
  notify();
};

export const usePushIndicators = (): PushIndicatorsState => {
  const [state, setState] = useState<PushIndicatorsState>(getPushIndicatorsSnapshot());

  useEffect(() => {
    let active = true;
    hydratePushIndicators().then((next) => {
      if (active) {
        setState(next);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => subscribePushIndicators(() => {
    setState(getPushIndicatorsSnapshot());
  }), []);

  return state;
};
