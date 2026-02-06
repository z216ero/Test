import type { AuthUserDto, BookingDto, SlotDto, UpcomingSessionDto } from '@generated/api';
import {
  getAuthMe,
  postSlotsSlotIdBook,
  postSlotsSlotIdCancel,
} from '@generated/api';
import { t } from '@i18n';
import { ApiError, unwrap } from './core';
import { ApiTimeoutError } from './fetcher';
import { customFetch } from './custom-fetch';

export type ClientBooking = {
  slot: SlotDto;
  trainerName?: string | null;
  trainerSpecialization?: string | null;
  trainerAvatarUrl?: string | null;
};

export class BookingConflictError extends ApiError {}
export class BookingTimeConflictError extends ApiError {}
export class BookingNotFoundError extends ApiError {}

const isTimeConflict = (details: unknown): boolean => {
  if (!details || typeof details !== 'object') {
    return false;
  }

  const problem = details as { title?: string | null; detail?: string | null };
  const title = problem.title?.toLowerCase() ?? '';
  const detail = problem.detail?.toLowerCase() ?? '';

  return title.includes('time conflict') || detail.includes('overlap');
};

const mapBookingError = (error: unknown): Error => {
  if (error instanceof ApiTimeoutError) {
    return error;
  }

  if (error instanceof TypeError) {
    return error;
  }

  if (error instanceof ApiError) {
    if (error.status === 409) {
      if (isTimeConflict(error.details)) {
        return new BookingTimeConflictError(
          t('errors.slotTimeConflict'),
          error.status,
          error.details
        );
      }

      return new BookingConflictError(
        t('errors.slotTaken'),
        error.status,
        error.details
      );
    }

    if (error.status === 404) {
      return new BookingNotFoundError(
        t('errors.slotNotFound'),
        error.status,
        error.details
      );
    }

    if (error.status === 400) {
      return error;
    }

    return new ApiError(t('errors.generic'), error.status, error.details);
  }

  if (error instanceof Error) {
    return new ApiError(error.message);
  }

  return new ApiError(t('errors.generic'));
};

const getCurrentUserId = async (options?: RequestInit): Promise<string> => {
  const response = await getAuthMe(options);
  const me = unwrap<AuthUserDto>(response, t('errors.generic'));
  if (!me.id) {
    throw new ApiError(t('errors.generic'));
  }

  return me.id;
};

export const createBooking = async (
  slotId: string,
  options?: RequestInit
): Promise<BookingDto> => {
  try {
    const clientId = await getCurrentUserId(options);
    const response = await postSlotsSlotIdBook(slotId, { clientId }, options);
    return unwrap<BookingDto>(response, t('errors.generic'));
  } catch (error) {
    throw mapBookingError(error);
  }
};

export const getMyBookings = async (
  options?: RequestInit
): Promise<ClientBooking[]> => {
  return getClientUpcomingBookings(options);
};

export const cancelBooking = async (slotId: string): Promise<void> => {
  const response = await postSlotsSlotIdCancel(slotId);
  unwrap<SlotDto>(response, t('errors.generic'));
};

const mapSessionToBooking = (session: UpcomingSessionDto): ClientBooking | null => {
  if (!session.slot) {
    return null;
  }
  return {
    slot: session.slot,
    trainerName: session.trainerName,
    trainerSpecialization: session.trainerSpecialization,
    trainerAvatarUrl: session.trainerAvatarUrl,
  };
};

export const getClientUpcomingBookings = async (
  options?: RequestInit
): Promise<ClientBooking[]> => {
  const response = await customFetch<{ status: number; data: UpcomingSessionDto[] }>(
    '/clients/me/upcoming',
    {
      ...options,
      method: 'GET',
    }
  );
  const data = unwrap<UpcomingSessionDto[]>(response, t('errors.generic'));
  return data
    .map(mapSessionToBooking)
    .filter((item): item is ClientBooking => item !== null);
};

export const getClientBookingHistory = async (
  options?: RequestInit
): Promise<ClientBooking[]> => {
  const response = await customFetch<{ status: number; data: UpcomingSessionDto[] }>(
    '/clients/me/history',
    {
      ...options,
      method: 'GET',
    }
  );
  const data = unwrap<UpcomingSessionDto[]>(response, t('errors.generic'));
  return data
    .map(mapSessionToBooking)
    .filter((item): item is ClientBooking => item !== null);
};


