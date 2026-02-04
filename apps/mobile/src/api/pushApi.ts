import { postPushTokens, postPushTokensDisable } from '@generated/api';
import { unwrap } from './core';

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
