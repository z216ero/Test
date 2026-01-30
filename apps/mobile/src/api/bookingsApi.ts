import type { AuthUserDto, BookingDto, SlotDto, UpcomingSessionDto } from '../generated/api';
import {
  getAuthMe,
  getClientsMeUpcoming,
  postSlotsSlotIdBook,
  postSlotsSlotIdCancel,
} from '../generated/api';
import { t } from '../i18n';
import { ApiError, unwrap } from './core';
import { ApiTimeoutError } from './fetcher';

export type ClientBooking = {
  slot: SlotDto;
  trainerName?: string | null;
  trainerSpecialization?: string | null;
};

export class BookingConflictError extends ApiError {}
export class BookingNotFoundError extends ApiError {}

const mapBookingError = (error: unknown): Error => {
  if (error instanceof ApiTimeoutError) {
    return error;
  }

  if (error instanceof TypeError) {
    return error;
  }

  if (error instanceof ApiError) {
    if (error.status === 409) {
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
  const response = await getClientsMeUpcoming(options);
  const data = unwrap<UpcomingSessionDto | null>(
    response,
    t('errors.generic')
  );

  if (!data?.slot) {
    return [];
  }

  return [
    {
      slot: data.slot,
      trainerName: data.trainerName,
      trainerSpecialization: data.trainerSpecialization,
    },
  ];
};

export const cancelBooking = async (slotId: string): Promise<void> => {
  const response = await postSlotsSlotIdCancel(slotId);
  unwrap<SlotDto>(response, t('errors.generic'));
};
