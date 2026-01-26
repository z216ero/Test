import * as Keychain from 'react-native-keychain';

const TOKEN_SERVICE = 'trainerapp.auth';
const TOKEN_USERNAME = 'accessToken';

export const getAccessToken = async (): Promise<string | null> => {
  const credentials = await Keychain.getGenericPassword({
    service: TOKEN_SERVICE,
  });

  if (!credentials) {
    return null;
  }

  return credentials.password;
};

export const setAccessToken = async (token: string): Promise<void> => {
  await Keychain.setGenericPassword(TOKEN_USERNAME, token, {
    service: TOKEN_SERVICE,
  });
};

export const clearAccessToken = async (): Promise<void> => {
  await Keychain.resetGenericPassword({ service: TOKEN_SERVICE });
};
