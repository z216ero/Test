import type {
  BookingDto,
  CreateSlotRequest,
  GetTrainersTrainerIdSlotsParams,
  SlotDto,
  TrainerDto,
} from '../generated/api';
import {
  getTrainersMe,
  getTrainersTrainerIdSlots,
  postSlotsSlotIdComplete,
  postSlotsSlotIdNoShow,
  postTrainersTrainerIdSlots,
} from '../generated/api';
import { t } from '../i18n';
import { ApiError, unwrap } from './core';

export class TrainerSlotsOverlapError extends ApiError {}
export class TrainerSlotsNotFoundError extends ApiError {}
export class TrainerSlotsConflictError extends ApiError {}

const mapCreateSlotError = (error: unknown): ApiError => {
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

const mapTrainerSlotsError = (error: unknown): ApiError => {
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

const mapAttendanceError = (error: unknown): ApiError => {
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

const getTrainerId = async (): Promise<string> => {
  const response = await getTrainersMe();
  const trainer = unwrap<TrainerDto>(response, t('errors.generic'));
  if (!trainer.id) {
    throw new ApiError(t('errors.generic'));
  }

  return trainer.id;
};

export const getMyTrainerSlots = async (
  params?: GetTrainersTrainerIdSlotsParams
): Promise<SlotDto[]> => {
  try {
    const trainerId = await getTrainerId();
    const response = await getTrainersTrainerIdSlots(trainerId, params);
    return unwrap<SlotDto[]>(response, t('errors.generic'));
  } catch (error) {
    throw mapTrainerSlotsError(error);
  }
};

export const createSlot = async (
  payload: CreateSlotRequest
): Promise<SlotDto> => {
  try {
    const trainerId = await getTrainerId();
    const response = await postTrainersTrainerIdSlots(trainerId, payload);
    return unwrap<SlotDto>(response, t('errors.generic'));
  } catch (error) {
    throw mapCreateSlotError(error);
  }
};

export const attendanceActionsAvailable = true;

export const markSlotCompleted = async (slotId: string): Promise<BookingDto> => {
  try {
    const response = await postSlotsSlotIdComplete(slotId);
    return unwrap<BookingDto>(response, t('errors.generic'));
  } catch (error) {
    throw mapAttendanceError(error);
  }
};

export const markSlotNoShow = async (slotId: string): Promise<BookingDto> => {
  try {
    const response = await postSlotsSlotIdNoShow(slotId);
    return unwrap<BookingDto>(response, t('errors.generic'));
  } catch (error) {
    throw mapAttendanceError(error);
  }
};
