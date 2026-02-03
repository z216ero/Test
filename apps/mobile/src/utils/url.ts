import { API_BASE_URL } from '@config/env';

export const buildAbsoluteUrl = (path: string): string => {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const trimmedBase = API_BASE_URL.endsWith('/')
    ? API_BASE_URL.slice(0, -1)
    : API_BASE_URL;
  const trimmedPath = path.startsWith('/') ? path : `/${path}`;
  return `${trimmedBase}${trimmedPath}`;
};

export const buildAvatarUrl = (userId: string): string =>
  buildAbsoluteUrl(`/users/${userId}/avatar`);

