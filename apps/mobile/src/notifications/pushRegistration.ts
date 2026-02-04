import { getApp } from '@react-native-firebase/app';
import {
  getMessaging,
  getToken,
  onTokenRefresh,
} from '@react-native-firebase/messaging';
import { PermissionsAndroid, Platform } from 'react-native';
import { getAccessToken } from '@auth/tokenStorage';
import { registerPushToken } from '@api/pushApi';

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
    } catch (err) {
      if (__DEV__) {
        console.warn('push: token refresh failed', err);
      }
    }
  });
};
