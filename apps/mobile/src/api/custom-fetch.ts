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
  if (contentType.includes('application/json')) {
    return response.json();
  }

  return response.text();
};

export const customFetch = async <T>(
  input: string,
  options: RequestInit = {}
): Promise<T> => {
  const response = await fetch(buildUrl(input), options);
  const data = await parseBody(response);

  if (!response.ok) {
    const message =
      typeof data === 'string' && data.trim().length > 0
        ? data
        : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return {
    status: response.status,
    data,
    headers: response.headers,
  } as T;
};
