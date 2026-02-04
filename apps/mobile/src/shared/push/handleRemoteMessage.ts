import type { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import type { QueryKey } from '@tanstack/react-query';
import { queryClient } from '@query/queryClient';
import { keys } from '@query/keys';
import {
  markPushEventProcessed,
  setScheduleBadgeUnread,
  upsertSlotHighlight,
  type SlotHighlight,
} from '@notifications/pushIndicators';
import { getNotificationSettings } from '@notifications/settings';
import { appendEvent } from '../notifications/eventStore';

type PushRoleHint = 'Trainer' | 'Client';
type PushType =
  | 'booking_created'
  | 'booking_cancelled'
  | 'slot_cancelled_by_trainer'
  | 'attendance_marked';

type PushPayload = {
  type: PushType;
  roleHint: PushRoleHint | null;
  trainerId?: string;
  clientId?: string;
  slotId: string;
  eventId?: string;
  occurredAtUtc?: string;
  slotStartsAtUtc?: string;
  slotDurationMinutes?: number;
  actorName?: string;
  actorRole?: PushRoleHint;
  trainerName?: string;
  clientName?: string;
};

const VALID_TYPES = new Set<PushType>([
  'booking_created',
  'booking_cancelled',
  'slot_cancelled_by_trainer',
  'attendance_marked',
]);

const INVALIDATE_DEBOUNCE_MS = 400;
const pendingInvalidations = new Map<string, QueryKey>();
let invalidateTimer: ReturnType<typeof setTimeout> | null = null;

const normalizeRoleHint = (value?: string | null): PushRoleHint | null => {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'trainer') {
    return 'Trainer';
  }
  if (normalized === 'client') {
    return 'Client';
  }
  return null;
};

const readString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const readNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
};

const parsePayload = (
  message: FirebaseMessagingTypes.RemoteMessage
): PushPayload | null => {
  const data = message.data ?? {};
  const type = readString(data.type) as PushType | undefined;
  if (!type || !VALID_TYPES.has(type)) {
    return null;
  }

  const slotId = readString(data.slotId);
  if (!slotId) {
    return null;
  }

  const slotStartsAtUtc = readString(data.slotStartsAtUtc ?? data.startsAtUtc);

  return {
    type,
    roleHint: normalizeRoleHint(readString(data.roleHint) ?? null),
    trainerId: readString(data.trainerId),
    clientId: readString(data.clientId),
    slotId,
    eventId: readString(data.eventId),
    occurredAtUtc: readString(data.occurredAtUtc),
    slotStartsAtUtc,
    slotDurationMinutes: readNumber(data.slotDurationMinutes),
    actorName: readString(data.actorName),
    actorRole: normalizeRoleHint(readString(data.actorRole) ?? null) ?? undefined,
    trainerName: readString(data.trainerName),
    clientName: readString(data.clientName),
  };
};

const pushInvalidations = (queryKeys: QueryKey[]) => {
  queryKeys.forEach((queryKey) => {
    const key = JSON.stringify(queryKey);
    pendingInvalidations.set(key, queryKey);
  });

  if (invalidateTimer) {
    return;
  }

  invalidateTimer = setTimeout(() => {
    const keysToInvalidate = Array.from(pendingInvalidations.values());
    pendingInvalidations.clear();
    invalidateTimer = null;

    keysToInvalidate.forEach((queryKey) => {
      queryClient.invalidateQueries({ queryKey });
    });
  }, INVALIDATE_DEBOUNCE_MS);
};

const collectClientKeys = (payload: PushPayload): QueryKey[] => {
  const list: QueryKey[] = [
    keys.bookings.upcoming(),
    keys.bookings.history(),
    keys.home.upcoming('Client'),
  ];

  if (payload.trainerId) {
    list.push(keys.trainers.slots(payload.trainerId));
  }

  return list;
};

const collectTrainerKeys = (): QueryKey[] => [
  keys.trainerSlots.mine(),
  keys.home.upcoming('Trainer'),
];

const buildInvalidationKeys = (payload: PushPayload): QueryKey[] => {
  const list: QueryKey[] = [];

  const includeClient = payload.roleHint === 'Client' || payload.roleHint === null;
  const includeTrainer = payload.roleHint === 'Trainer' || payload.roleHint === null;

  if (payload.type === 'booking_created' || payload.type === 'booking_cancelled') {
    if (includeClient) {
      list.push(...collectClientKeys(payload));
    }
    if (includeTrainer) {
      list.push(...collectTrainerKeys());
    }
    return list;
  }

  if (payload.type === 'slot_cancelled_by_trainer' || payload.type === 'attendance_marked') {
    if (includeTrainer) {
      list.push(...collectTrainerKeys());
    }
    if (includeClient) {
      list.push(...collectClientKeys(payload));
    }
  }

  return list;
};

const buildTrainerHighlight = (payload: PushPayload): SlotHighlight | null => {
  if (!payload.eventId) {
    return null;
  }

  const parsedOccurredAt = payload.occurredAtUtc
    ? Date.parse(payload.occurredAtUtc)
    : Number.NaN;
  const createdAt = Number.isNaN(parsedOccurredAt) ? Date.now() : parsedOccurredAt;

  if (payload.type === 'booking_created') {
    return {
      eventId: payload.eventId,
      type: 'booking_created',
      color: 'success',
      chipText: 'NEW',
      createdAt,
      seen: false,
    };
  }

  if (payload.type === 'booking_cancelled') {
    return {
      eventId: payload.eventId,
      type: 'booking_cancelled',
      color: 'destructive',
      chipText: 'Отмена',
      createdAt,
      seen: false,
    };
  }

  return null;
};

export type RemoteMessageSource = 'foreground' | 'background' | 'initial' | 'opened';

export const handleRemoteMessage = async (
  message: FirebaseMessagingTypes.RemoteMessage,
  _context?: { source: RemoteMessageSource }
): Promise<void> => {
  const payload = parsePayload(message);
  if (!payload) {
    return;
  }

  if (payload.eventId) {
    const alreadyProcessed = await markPushEventProcessed(payload.eventId);
    if (alreadyProcessed) {
      return;
    }
  }

  const settings = await getNotificationSettings();
  const inAppEventsEnabled = settings.inAppBookingEventsEnabled;

  const isTrainerTarget = payload.roleHint === 'Trainer' || payload.roleHint === null;

  if (
    isTrainerTarget
    && (payload.type === 'booking_created' || payload.type === 'booking_cancelled')
  ) {
    await setScheduleBadgeUnread();
    const highlight = buildTrainerHighlight(payload);
    if (highlight) {
      await upsertSlotHighlight(payload.slotId, highlight);
    }
  }

  if (inAppEventsEnabled) {
    await appendEvent({
      id: payload.eventId,
      type: payload.type,
      occurredAtUtc: payload.occurredAtUtc,
      slotId: payload.slotId,
      slotStartsAtUtc: payload.slotStartsAtUtc,
      slotDurationMinutes: payload.slotDurationMinutes,
      actorName: payload.actorName,
      actorRole: payload.actorRole,
      trainerName: payload.trainerName,
      clientName: payload.clientName,
    });
  }

  const keysToInvalidate = buildInvalidationKeys(payload);
  if (keysToInvalidate.length === 0) {
    return;
  }

  pushInvalidations(keysToInvalidate);
};

