import AsyncStorage from '@react-native-async-storage/async-storage';

export type NotificationSettings = {
  enabled: boolean;
  reminderOffsetMinutes: number;
  inAppBookingEventsEnabled: boolean;
  inAppGroupMinCancellationEventsEnabled: boolean;
};

const STORAGE_KEY = 'notifications.settings.v1';

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  reminderOffsetMinutes: 120,
  inAppBookingEventsEnabled: true,
  inAppGroupMinCancellationEventsEnabled: true,
};

const coerceSettings = (value: Partial<NotificationSettings> | null): NotificationSettings => ({
  enabled: value?.enabled ?? DEFAULT_SETTINGS.enabled,
  reminderOffsetMinutes:
    value?.reminderOffsetMinutes ?? DEFAULT_SETTINGS.reminderOffsetMinutes,
  inAppBookingEventsEnabled:
    value?.inAppBookingEventsEnabled ?? DEFAULT_SETTINGS.inAppBookingEventsEnabled,
  inAppGroupMinCancellationEventsEnabled:
    value?.inAppGroupMinCancellationEventsEnabled
    ?? DEFAULT_SETTINGS.inAppGroupMinCancellationEventsEnabled,
});

export const getNotificationSettings = async (): Promise<NotificationSettings> => {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return DEFAULT_SETTINGS;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<NotificationSettings>;
    return coerceSettings(parsed);
  } catch {
    return DEFAULT_SETTINGS;
  }
};

export const setNotificationSettings = async (
  partial: Partial<NotificationSettings>
): Promise<NotificationSettings> => {
  const current = await getNotificationSettings();
  const next = coerceSettings({ ...current, ...partial });
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
};
