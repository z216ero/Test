import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '@api/core';
import { ApiHttpError, ApiTimeoutError } from '@api/fetcher';

const MAX_RETRIES = 2;

const getStatus = (error: unknown): number | undefined => {
  if (error instanceof ApiHttpError || error instanceof ApiError) {
    return error.status;
  }

  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === 'number' ? status : undefined;
  }

  return undefined;
};

const isNetworkError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.name === 'TypeError' ||
    /network request failed/i.test(error.message) ||
    /failed to fetch/i.test(error.message)
  );
};

const shouldRetry = (failureCount: number, error: unknown): boolean => {
  if (failureCount > MAX_RETRIES) {
    return false;
  }

  if (error instanceof ApiTimeoutError) {
    return true;
  }

  const status = getStatus(error);
  if (typeof status === 'number') {
    return status === 429 || status >= 500;
  }

  return isNetworkError(error);
};

const retryDelay = (attempt: number): number =>
  Math.min(2000, 300 * 2 ** attempt);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetry,
      retryDelay,
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnReconnect: true,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

