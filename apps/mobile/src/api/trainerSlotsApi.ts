import type {
  BookingDto,
  CloseBookingResultDto,
  CreateSlotRequest,
  GetTrainersTrainerIdSlotsParams,
  SlotDto,
  SlotAttendeeDto,
  TrainerDto,
} from '@generated/api';
import {
  getTrainersMe,
  getSlotsSlotIdAttendees,
  postSlotsSlotIdAttendeesClientIdComplete,
  postSlotsSlotIdAttendeesClientIdNoShow,
  getTrainersTrainerIdSlots,
  patchBookingsBookingIdClose,
  postSlotsSlotIdCancel,
  postSlotsSlotIdComplete,
  postSlotsSlotIdNoShow,
  postTrainersMeSlots,
} from '@generated/api';
import { t } from '@i18n';
import { ApiError, unwrap } from './core';
import { ApiTimeoutError } from './fetcher';

export class TrainerSlotsOverlapError extends ApiError {}
export class TrainerSlotsNotFoundError extends ApiError {}
export class TrainerSlotsConflictError extends ApiError {}
export type AttendanceCloseStatus = 'Completed' | 'NoShow';
export type PaymentMethod = 'Cash' | 'Transfer' | 'SBP' | 'Other';

let cachedTrainerId: string | null = null;

const mapCreateSlotError = (error: unknown): Error => {
  if (error instanceof ApiTimeoutError) {
    return error;
  }

  if (error instanceof TypeError) {
    return error;
  }

  if (error instanceof ApiError) {
    if (error.status === 409) {
      return new TrainerSlotsOverlapError(
        t('errors.overlap'),
        error.status,
        error.details
      );
    }

    if (error.status === 404) {
      return new TrainerSlotsNotFoundError(
        t('errors.notFound'),
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

const mapTrainerSlotsError = (error: unknown): Error => {
  if (error instanceof ApiTimeoutError) {
    return error;
  }

  if (error instanceof TypeError) {
    return error;
  }

  if (error instanceof ApiError) {
    if (error.status === 404) {
      return new TrainerSlotsNotFoundError(
        t('errors.notFound'),
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

const mapAttendanceError = (error: unknown): Error => {
  if (error instanceof ApiTimeoutError) {
    return error;
  }

  if (error instanceof TypeError) {
    return error;
  }

  if (error instanceof ApiError) {
    if (error.status === 409) {
      return new TrainerSlotsConflictError(
        t('errors.conflict'),
        error.status,
        error.details
      );
    }

    if (error.status === 404) {
      return new TrainerSlotsNotFoundError(
        t('errors.notFound'),
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

const getTrainerId = async (options?: RequestInit): Promise<string> => {
  if (cachedTrainerId) {
    return cachedTrainerId;
  }

  const response = await getTrainersMe(options);
  const trainer = unwrap<TrainerDto>(response, t('errors.generic'));
  if (!trainer.id) {
    throw new ApiError(t('errors.generic'));
  }

  cachedTrainerId = trainer.id;
  return trainer.id;
};

export const clearTrainerIdCache = (): void => {
  cachedTrainerId = null;
};

export const getMyTrainerSlots = async (
  params?: GetTrainersTrainerIdSlotsParams,
  options?: RequestInit
): Promise<SlotDto[]> => {
  try {
    const trainerId = await getTrainerId(options);
    const response = await getTrainersTrainerIdSlots(
      trainerId,
      params,
      options
    );
    return unwrap<SlotDto[]>(response, t('errors.generic'));
  } catch (error) {
    throw mapTrainerSlotsError(error);
  }
};

export const createSlot = async (
  payload: CreateSlotRequest,
  options?: RequestInit
): Promise<SlotDto> => {
  try {
    const response = await postTrainersMeSlots(payload, options);
    return unwrap<SlotDto>(response, t('errors.generic'));
  } catch (error) {
    throw mapCreateSlotError(error);
  }
};

export const attendanceActionsAvailable = true;

export const markSlotCompleted = async (
  slotId: string,
  options?: RequestInit
): Promise<BookingDto> => {
  try {
    const response = await postSlotsSlotIdComplete(slotId, options);
    return unwrap<BookingDto>(response, t('errors.generic'));
  } catch (error) {
    throw mapAttendanceError(error);
  }
};

export const markSlotNoShow = async (
  slotId: string,
  options?: RequestInit
): Promise<BookingDto> => {
  try {
    const response = await postSlotsSlotIdNoShow(slotId, options);
    return unwrap<BookingDto>(response, t('errors.generic'));
  } catch (error) {
    throw mapAttendanceError(error);
  }
};

export const cancelTrainerSlot = async (
  slotId: string,
  options?: RequestInit
): Promise<SlotDto> => {
  try {
    const response = await postSlotsSlotIdCancel(slotId, options);
    return unwrap<SlotDto>(response, t('errors.generic'));
  } catch (error) {
    throw mapAttendanceError(error);
  }
};

export const closeTrainerBooking = async (
  bookingId: string,
  attendance: AttendanceCloseStatus,
  payment: { markPaid: boolean; method: PaymentMethod | null },
  options?: RequestInit
): Promise<CloseBookingResultDto> => {
  try {
    const response = await patchBookingsBookingIdClose(
      bookingId,
      {
        attendance,
        payment: {
          markPaid: payment.markPaid,
          method: payment.method,
        },
      },
      options
    );
    return unwrap<CloseBookingResultDto>(response, t('errors.generic'));
  } catch (error) {
    throw mapAttendanceError(error);
  }
};

export const getGroupSlotAttendees = async (
  slotId: string,
  options?: RequestInit
): Promise<SlotAttendeeDto[]> => {
  try {
    const response = await getSlotsSlotIdAttendees(slotId, options);
    return unwrap<SlotAttendeeDto[]>(response, t('errors.generic'));
  } catch (error) {
    throw mapAttendanceError(error);
  }
};

export const markGroupAttendeeCompleted = async (
  slotId: string,
  clientId: string,
  options?: RequestInit
): Promise<SlotAttendeeDto> => {
  try {
    const response = await postSlotsSlotIdAttendeesClientIdComplete(slotId, clientId, options);
    return unwrap<SlotAttendeeDto>(response, t('errors.generic'));
  } catch (error) {
    throw mapAttendanceError(error);
  }
};

export const markGroupAttendeeNoShow = async (
  slotId: string,
  clientId: string,
  options?: RequestInit
): Promise<SlotAttendeeDto> => {
  try {
    const response = await postSlotsSlotIdAttendeesClientIdNoShow(slotId, clientId, options);
    return unwrap<SlotAttendeeDto>(response, t('errors.generic'));
  } catch (error) {
    throw mapAttendanceError(error);
  }
};


