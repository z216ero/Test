import { postPushTokens, postPushTokensDisable } from '@generated/api';
import { customFetch } from './custom-fetch';
import { unwrap } from './core';

export type PushPreferences = {
  eventsEnabled: boolean;
  groupMinCancellationEnabled: boolean;
  reminderEnabled: boolean;
  reminderOffsetMinutes: number;
};

export const registerPushToken = async (
  token: string,
  platform: 'android' | 'ios'
): Promise<void> => {
  const response = await postPushTokens({ token, platform });
  unwrap(response, 'Unable to register push token.');
};

export const disablePushToken = async (token: string): Promise<void> => {
  const response = await postPushTokensDisable({ token });
  unwrap(response, 'Unable to disable push token.');
};

export const getPushPreferences = async (): Promise<PushPreferences> => {
  const response = await customFetch<{ status: number; data: unknown }>(
    '/push/preferences',
    { method: 'GET' }
  );
  return unwrap<PushPreferences>(
    response,
    'Unable to load push notification preferences.'
  );
};

export const updatePushPreferences = async (
  preferences: PushPreferences
): Promise<PushPreferences> => {
  const response = await customFetch<{ status: number; data: unknown }>(
    '/push/preferences',
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(preferences),
    }
  );
  return unwrap<PushPreferences>(
    response,
    'Unable to update push notification preferences.'
  );
};
