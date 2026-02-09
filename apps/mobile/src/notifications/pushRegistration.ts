import { getApp } from '@react-native-firebase/app';
import {
  getMessaging,
  getToken,
  onTokenRefresh,
} from '@react-native-firebase/messaging';
import { PermissionsAndroid, Platform } from 'react-native';
import { getAccessToken } from '@auth/tokenStorage';
import { registerPushToken, updatePushPreferences } from '@api/pushApi';
import { getNotificationSettings } from './settings';

const PLATFORM_ANDROID = 'android' as const;

let permissionPromise: Promise<boolean> | null = null;

const requestAndroidPermission = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') {
    return false;
  }

  if (typeof Platform.Version === 'number' && Platform.Version < 33) {
    return true;
  }

  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
  );

  return result === PermissionsAndroid.RESULTS.GRANTED;
};

const ensurePermission = async (): Promise<boolean> => {
  if (!permissionPromise) {
    permissionPromise = requestAndroidPermission();
  }
  return permissionPromise;
};

const registerTokenWithBackend = async (token: string): Promise<boolean> => {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return false;
  }

  await registerPushToken(token, PLATFORM_ANDROID);
  return true;
};

const syncPushPreferencesFromSettings = async (): Promise<void> => {
  const settings = await getNotificationSettings();
  await updatePushPreferences({
    eventsEnabled: settings.inAppBookingEventsEnabled,
    groupMinCancellationEnabled: settings.inAppGroupMinCancellationEventsEnabled,
    reminderEnabled: settings.enabled,
    reminderOffsetMinutes: settings.reminderOffsetMinutes,
  });
};

export const registerPushTokenIfPossible = async (): Promise<void> => {
  if (Platform.OS !== 'android') {
    return;
  }

  const hasPermission = await ensurePermission();
  if (!hasPermission) {
    return;
  }

  try {
    const token = await getToken(getMessaging(getApp()));
    if (!token) {
      return;
    }
    const registered = await registerTokenWithBackend(token);
    if (registered) {
      await syncPushPreferencesFromSettings();
    }
  } catch (err) {
    if (__DEV__) {
      console.warn('push: token registration failed', err);
    }
  }
};

export const registerPushTokenRefreshListener = (): (() => void) => {
  const messaging = getMessaging(getApp());
  return onTokenRefresh(messaging, async (token) => {
    try {
      const registered = await registerTokenWithBackend(token);
      if (registered) {
        await syncPushPreferencesFromSettings();
      }
    } catch (err) {
      if (__DEV__) {
        console.warn('push: token refresh failed', err);
      }
    }
  });
};
