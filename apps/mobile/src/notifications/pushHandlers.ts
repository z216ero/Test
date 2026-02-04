import type { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import type { QueryKey } from '@tanstack/react-query';
import { keys } from '@query/keys';
import { queryClient } from '@query/queryClient';

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
  startsAtUtc?: string;
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

  return {
    type,
    roleHint: normalizeRoleHint(readString(data.roleHint) ?? null),
    trainerId: readString(data.trainerId),
    clientId: readString(data.clientId),
    slotId,
    startsAtUtc: readString(data.startsAtUtc),
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

export const handlePushMessage = async (
  message: FirebaseMessagingTypes.RemoteMessage
): Promise<void> => {
  const payload = parsePayload(message);
  if (!payload) {
    return;
  }

  const keysToInvalidate = buildInvalidationKeys(payload);
  if (keysToInvalidate.length === 0) {
    return;
  }

  pushInvalidations(keysToInvalidate);
};
