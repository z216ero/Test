import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from '../auth/tokenStorage';
import { API_BASE_URL } from '../config/env';

const trimTrailingSlash = (value: string): string =>
  value.endsWith('/') ? value.slice(0, -1) : value;

const ensureLeadingSlash = (value: string): string =>
  value.startsWith('/') ? value : `/${value}`;

const buildUrl = (input: string): string => {
  if (/^https?:\/\//i.test(input)) {
    const match = input.match(/^https?:\/\/[^/]+(\/.*)?$/i);
    const pathAndQuery = match?.[1] ?? '/';
    return `${trimTrailingSlash(API_BASE_URL)}${ensureLeadingSlash(
      pathAndQuery
    )}`;
  }

  return `${trimTrailingSlash(API_BASE_URL)}${ensureLeadingSlash(input)}`;
};

const parseBody = async (response: Response): Promise<unknown> => {
  if (response.status === 204) {
    return undefined;
  }

  const contentType = response.headers.get('content-type') || '';
  const isJson =
    contentType.includes('application/json') || contentType.includes('+json');
  if (isJson) {
    return response.json();
  }

  return response.text();
};

export const customFetch = async <T>(
  input: string,
  options: RequestInit = {}
): Promise<T> => {
  const isRefreshRequest = input.includes('/auth/refresh');
  const token = await getAccessToken();
  const headers = new Headers(options.headers ?? {});
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response = await fetch(buildUrl(input), {
    ...options,
    headers,
  });

  if (response.status === 401 && !isRefreshRequest && token) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      const retryHeaders = new Headers(options.headers ?? {});
      retryHeaders.set('Authorization', `Bearer ${refreshed}`);
      response = await fetch(buildUrl(input), {
        ...options,
        headers: retryHeaders,
      });
    }
  }

  const data = await parseBody(response);
  return {
    status: response.status,
    data,
    headers: response.headers,
  } as T;
};

const tryRefreshToken = async (): Promise<string | null> => {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    return null;
  }

  const response = await fetch(buildUrl('/auth/refresh'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    await clearSession();
    return null;
  }

  const data = (await response.json()) as {
    accessToken?: string | null;
    refreshToken?: string | null;
  };

  if (data.accessToken) {
    await setAccessToken(data.accessToken);
  }

  if (data.refreshToken) {
    await setRefreshToken(data.refreshToken);
  }

  return data.accessToken ?? null;
};
