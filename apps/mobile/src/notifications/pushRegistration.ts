import { getApp } from '@react-native-firebase/app';
import {
  getMessaging,
  getToken,
  onTokenRefresh,
} from '@react-native-firebase/messaging';
import { PermissionsAndroid, Platform } from 'react-native';
import { getAccessToken } from '@auth/tokenStorage';
import { disablePushToken, registerPushToken } from '@api/pushApi';
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

const registerTokenWithBackend = async (token: string): Promise<void> => {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return;
  }

  await registerPushToken(token, PLATFORM_ANDROID);
};

const syncTokenEnabledState = async (token: string): Promise<void> => {
  const settings = await getNotificationSettings();
  if (!settings.inAppBookingEventsEnabled) {
    await disablePushToken(token);
  }
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
    await registerTokenWithBackend(token);
    await syncTokenEnabledState(token);
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
      await registerTokenWithBackend(token);
      await syncTokenEnabledState(token);
    } catch (err) {
      if (__DEV__) {
        console.warn('push: token refresh failed', err);
      }
    }
  });
};

export const setPushTokenEnabled = async (enabled: boolean): Promise<void> => {
  if (Platform.OS !== 'android') {
    return;
  }

  if (enabled) {
    const hasPermission = await ensurePermission();
    if (!hasPermission) {
      return;
    }
  }

  try {
    const token = await getToken(getMessaging(getApp()));
    if (!token) {
      return;
    }
    if (enabled) {
      await registerTokenWithBackend(token);
      return;
    }
    await registerTokenWithBackend(token);
    await disablePushToken(token);
  } catch (err) {
    if (__DEV__) {
      console.warn('push: token toggle failed', err);
    }
  }
};
