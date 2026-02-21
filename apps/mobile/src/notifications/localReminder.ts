import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

type ReminderParams = {
  bookingId: string;
  startAtUtcIso: string;
  fireAtUtcIso: string;
  title: string;
  body: string;
};

type ReminderEntry = ReminderParams & {
  notificationId: string;
};

type NotifeeLike = {
  createChannel?: (payload: { id: string; name: string }) => Promise<void>;
  createTriggerNotification?: (notification: unknown, trigger: unknown) => Promise<string>;
  cancelTriggerNotification?: (notificationId: string) => Promise<void>;
};

const STORAGE_KEY = 'notifications.reminders.v1';
const ANDROID_CHANNEL_ID = 'training-reminders';

const loadMap = async (): Promise<Record<string, ReminderEntry>> => {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, ReminderEntry>;
    return parsed ?? {};
  } catch {
    return {};
  }
};

const saveMap = async (map: Record<string, ReminderEntry>): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map));
};

const getNotifeeModule = async () => {
  try {
    const mod = await import('@notifee/react-native');
    return mod;
  } catch {
    return null;
  }
};

export const createAndroidChannelIfNeeded = async (): Promise<void> => {
  if (Platform.OS !== 'android') {
    return;
  }
  const module = await getNotifeeModule();
  const notifee = (module?.default ?? module) as NotifeeLike | null;
  if (!notifee) {
    return;
  }

  await notifee.createChannel?.({
    id: ANDROID_CHANNEL_ID,
    name: 'Training reminders',
  });
};

export const scheduleTrainingReminder = async (
  params: ReminderParams
): Promise<void> => {
  const module = await getNotifeeModule();
  const notifee = (module?.default ?? module) as NotifeeLike | null;
  const TriggerType = module?.TriggerType;
  if (!notifee || !TriggerType || !notifee.createTriggerNotification) {
    // TODO: integrate @notifee/react-native for scheduled local notifications.
    return;
  }

  const map = await loadMap();
  if (map[params.bookingId]) {
    await cancelTrainingReminder(params.bookingId);
  }

  await createAndroidChannelIfNeeded();

  const fireDate = new Date(params.fireAtUtcIso);
  if (Number.isNaN(fireDate.getTime())) {
    return;
  }

  const trigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: fireDate.getTime(),
  };

  const notificationId = await notifee.createTriggerNotification(
    {
      title: params.title,
      body: params.body,
      android: {
        channelId: ANDROID_CHANNEL_ID,
      },
    },
    trigger
  );

  map[params.bookingId] = {
    ...params,
    notificationId,
  };
  await saveMap(map);
};

export const cancelTrainingReminder = async (
  bookingId: string
): Promise<void> => {
  const map = await loadMap();
  const entry = map[bookingId];
  if (!entry) {
    return;
  }

  const module = await getNotifeeModule();
  const notifee = (module?.default ?? module) as NotifeeLike | null;
  if (notifee?.cancelTriggerNotification) {
    await notifee.cancelTriggerNotification(entry.notificationId);
  }

  delete map[bookingId];
  await saveMap(map);
};

export const getScheduledBookingIds = async (): Promise<string[]> => {
  const map = await loadMap();
  return Object.keys(map);
};

export const getScheduledEntries = async (): Promise<ReminderEntry[]> => {
  const map = await loadMap();
  return Object.values(map);
};

export const clearAllTrainingReminders = async (): Promise<void> => {
  const map = await loadMap();
  const entries = Object.values(map);

  const module = await getNotifeeModule();
  const notifee = (module?.default ?? module) as NotifeeLike | null;
  const cancelTrigger = notifee?.cancelTriggerNotification;
  if (cancelTrigger) {
    await Promise.allSettled(
      entries.map((entry) => cancelTrigger(entry.notificationId))
    );
  }

  await AsyncStorage.removeItem(STORAGE_KEY);
};
