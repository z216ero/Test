import { getPendingBookingConfirmationsCount } from '@api/bookingsApi';
import { getPendingLinkRequestsCount } from '@api/clientLinksApi';
import { useAppQuery } from './hooks';
import { keys } from './keys';

const REFRESH_MS = 30_000;

export const usePendingLinkRequestsCount = (enabled: boolean = true) =>
  useAppQuery({
    queryKey: keys.pendingLinkRequestsCount(),
    queryFn: ({ signal }) => getPendingLinkRequestsCount({ signal }),
    enabled,
    staleTime: 10_000,
    refetchInterval: enabled ? REFRESH_MS : false,
    refetchIntervalInBackground: false,
  });

export const usePendingBookingConfirmationsCount = (enabled: boolean = true) =>
  useAppQuery({
    queryKey: keys.pendingBookingConfirmationsCount(),
    queryFn: ({ signal }) => getPendingBookingConfirmationsCount({ signal }),
    enabled,
    staleTime: 10_000,
    refetchInterval: enabled ? REFRESH_MS : false,
    refetchIntervalInBackground: false,
  });

