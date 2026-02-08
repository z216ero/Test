import * as Keychain from 'react-native-keychain';

const TOKEN_SERVICE = 'trainerapp.auth';
const TOKEN_USERNAME = 'accessToken';
const REFRESH_TOKEN_SERVICE = 'trainerapp.refresh';
const REFRESH_TOKEN_USERNAME = 'refreshToken';

let cachedAccessToken: string | null | undefined;

export const getAccessToken = async (): Promise<string | null> => {
  if (cachedAccessToken !== undefined) {
    return cachedAccessToken;
  }

  const credentials = await Keychain.getGenericPassword({
    service: TOKEN_SERVICE,
  });

  if (!credentials) {
    cachedAccessToken = null;
    return null;
  }

  cachedAccessToken = credentials.password;
  return credentials.password;
};

export const setAccessToken = async (token: string): Promise<void> => {
  await Keychain.setGenericPassword(TOKEN_USERNAME, token, {
    service: TOKEN_SERVICE,
  });
  cachedAccessToken = token;
};

export const clearAccessToken = async (): Promise<void> => {
  await Keychain.resetGenericPassword({ service: TOKEN_SERVICE });
  cachedAccessToken = null;
};

export const getRefreshToken = async (): Promise<string | null> => {
  const credentials = await Keychain.getGenericPassword({
    service: REFRESH_TOKEN_SERVICE,
  });

  if (!credentials) {
    return null;
  }

  return credentials.password;
};

export const setRefreshToken = async (token: string): Promise<void> => {
  await Keychain.setGenericPassword(REFRESH_TOKEN_USERNAME, token, {
    service: REFRESH_TOKEN_SERVICE,
  });
};

export const clearRefreshToken = async (): Promise<void> => {
  await Keychain.resetGenericPassword({ service: REFRESH_TOKEN_SERVICE });
};

export const clearSession = async (): Promise<void> => {
  await Promise.all([clearAccessToken(), clearRefreshToken()]);
};
