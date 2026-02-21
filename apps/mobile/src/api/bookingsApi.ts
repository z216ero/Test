import type { AuthUserDto, PaymentDto, SlotDto, UpcomingSessionDto } from '@generated/api';
import {
  getAuthMe,
  getBookingsBookingIdPayment,
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
  trainerPhoneNumber?: string | null;
  trainerGender?: string | null;
  trainerWorksWithGender?: string | null;
  trainerRating?: number | null;
  trainerCityName?: string | null;
  trainerDistrictName?: string | null;
  trainerSpecializations?: string[] | null;
  trainerTrainingTypes?: string[] | null;
  trainerAvatarUrl?: string | null;
  paymentStatus?: string | null;
};

type ExtendedUpcomingSessionDto = UpcomingSessionDto & {
  trainerPhoneNumber?: string | null;
  trainerGender?: string | null;
  trainerWorksWithGender?: string | null;
  trainerRating?: number | null;
};

export class BookingConflictError extends ApiError {}
export class BookingTimeConflictError extends ApiError {}
export class BookingSlotFullError extends ApiError {}
export class BookingNotFoundError extends ApiError {}

const readErrorCode = (details: unknown): string | null => {
  if (!details || typeof details !== 'object') {
    return null;
  }

  const maybeCode = (details as { errorCode?: unknown }).errorCode;
  if (typeof maybeCode === 'string' && maybeCode.trim().length > 0) {
    return maybeCode.trim();
  }

  return null;
};

const isTimeConflict = (details: unknown): boolean => {
  const code = readErrorCode(details);
  if (code === 'booking_time_conflict') {
    return true;
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
      const code = readErrorCode(error.details);
      if (code === 'slot_full') {
        return new BookingSlotFullError(
          t('slots.status.full'),
          error.status,
          error.details
        );
      }

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
): Promise<SlotDto> => {
  try {
    const clientId = await getCurrentUserId(options);
    const response = await postSlotsSlotIdBook(slotId, { clientId }, options);
    return unwrap<SlotDto>(response, t('errors.generic'));
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
  const extended = session as ExtendedUpcomingSessionDto;

  return {
    slot: session.slot,
    trainerName: session.trainerName,
    trainerPhoneNumber: extended.trainerPhoneNumber,
    trainerGender: extended.trainerGender,
    trainerWorksWithGender: extended.trainerWorksWithGender,
    trainerRating: extended.trainerRating,
    trainerCityName: session.trainerCityName,
    trainerDistrictName: session.trainerDistrictName,
    trainerSpecializations: session.trainerSpecializations,
    trainerTrainingTypes: session.trainerTrainingTypes,
    trainerAvatarUrl: session.trainerAvatarUrl,
  };
};

const isCompletedStatus = (value?: string | null): boolean =>
  (value ?? '').trim().toLowerCase() === 'completed';

const paymentStatusCache = new Map<string, string | null>();

const enrichPaymentStatuses = async (
  bookings: ClientBooking[],
  options?: RequestInit
): Promise<ClientBooking[]> => {
  const completedWithBookingId = bookings.filter(
    (item) => isCompletedStatus(item.slot.bookingStatus) && Boolean(item.slot.bookingId)
  );

  if (completedWithBookingId.length === 0) {
    return bookings;
  }

  const paymentStatusByBookingId = new Map<string, string | null>();
  const bookingIdsToLoad: string[] = [];

  completedWithBookingId.forEach((item) => {
    const bookingId = item.slot.bookingId;
    if (!bookingId) {
      return;
    }

    if (paymentStatusCache.has(bookingId)) {
      paymentStatusByBookingId.set(bookingId, paymentStatusCache.get(bookingId) ?? null);
      return;
    }

    bookingIdsToLoad.push(bookingId);
  });

  await Promise.all(
    bookingIdsToLoad.map(async (bookingId) => {
      try {
        const response = await getBookingsBookingIdPayment(bookingId, options);
        const payment = unwrap<PaymentDto>(response, t('errors.generic'));
        paymentStatusCache.set(bookingId, payment.status ?? null);
        paymentStatusByBookingId.set(bookingId, payment.status ?? null);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          paymentStatusCache.set(bookingId, null);
          paymentStatusByBookingId.set(bookingId, null);
          return;
        }

        if (__DEV__) {
          console.warn('Failed to load payment status for booking', bookingId, error);
        }
      }
    })
  );

  return bookings.map((item) => {
    const bookingId = item.slot.bookingId;
    if (!bookingId || !isCompletedStatus(item.slot.bookingStatus)) {
      return item;
    }

    return {
      ...item,
      paymentStatus: paymentStatusByBookingId.get(bookingId) ?? null,
    };
  });
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
  const bookings = data
    .map(mapSessionToBooking)
    .filter((item): item is ClientBooking => item !== null);
  return enrichPaymentStatuses(bookings, options);
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
  const bookings = data
    .map(mapSessionToBooking)
    .filter((item): item is ClientBooking => item !== null);
  return enrichPaymentStatuses(bookings, options);
};

type PendingCountPayload = {
  count: number;
};

export const confirmClientBooking = async (
  bookingId: string,
  options?: RequestInit
): Promise<void> => {
  const response = await customFetch<{ status: number; data: unknown }>(
    `/client/bookings/${bookingId}/confirm`,
    {
      ...options,
      method: 'POST',
    }
  );
  unwrap(response, t('errors.generic'));
};

export const declineClientBooking = async (
  bookingId: string,
  options?: RequestInit
): Promise<void> => {
  const response = await customFetch<{ status: number; data: unknown }>(
    `/client/bookings/${bookingId}/decline`,
    {
      ...options,
      method: 'POST',
    }
  );
  unwrap(response, t('errors.generic'));
};

export const getPendingBookingConfirmationsCount = async (
  options?: RequestInit
): Promise<number> => {
  const response = await customFetch<{ status: number; data: unknown }>(
    '/client/me/pending-booking-confirmations/count',
    {
      ...options,
      method: 'GET',
    }
  );
  const payload = unwrap<PendingCountPayload>(
    response,
    t('errors.generic')
  );
  return payload.count ?? 0;
};


