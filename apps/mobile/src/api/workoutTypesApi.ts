import { ApiError, unwrap } from './core';
import { customFetch } from './custom-fetch';
import { ApiTimeoutError } from './fetcher';

export type WorkoutTypeCategory =
  | 'Strength'
  | 'Cardio'
  | 'Mobility'
  | 'Rehab'
  | 'Technique'
  | 'Other';

export type WorkoutTypeSummary = {
  id: string;
  name: string;
  category: WorkoutTypeCategory;
  isSystem: boolean;
  isArchived: boolean;
};

export type TrainerWorkoutType = WorkoutTypeSummary;

export type SetBookingWorkoutTypeResponse = {
  bookingId: string;
  workoutTypeId: string | null;
  workoutType?: WorkoutTypeSummary | null;
  updatedAtUtc?: string | null;
};

const systemWorkoutTypeRuNames: Record<string, string> = {
  'Full body': 'Все тело',
  Split: 'Сплит',
  Chest: 'Грудь',
  Back: 'Спина',
  Legs: 'Ноги',
  Shoulders: 'Плечи',
  Arms: 'Руки',
  Core: 'Кор',
  Cardio: 'Кардио',
  Mobility: 'Мобильность',
  Rehab: 'Реабилитация',
  Technique: 'Техника',
};

const localizeWorkoutTypeName = (name?: string | null): string => {
  const trimmed = (name ?? '').trim();
  if (!trimmed) {
    return '';
  }
  return systemWorkoutTypeRuNames[trimmed] ?? trimmed;
};

const mapWorkoutTypeSummary = <T extends WorkoutTypeSummary>(item: T): T => ({
  ...item,
  name: localizeWorkoutTypeName(item.name),
});

const mapError = (error: unknown): Error => {
  if (error instanceof ApiTimeoutError || error instanceof TypeError || error instanceof ApiError) {
    return error;
  }
  if (error instanceof Error) {
    return new ApiError(error.message);
  }
  return new ApiError('Something went wrong.');
};

export const getTrainerWorkoutTypes = async (
  includeArchived = false,
  options?: RequestInit
): Promise<TrainerWorkoutType[]> => {
  try {
    const query = includeArchived ? '?includeArchived=true' : '';
    const response = await customFetch<{ status: number; data: unknown }>(
      `/trainer/workout-types${query}`,
      options
    );
    return unwrap<TrainerWorkoutType[]>(response, 'Не удалось загрузить типы тренировок.')
      .map((item) => mapWorkoutTypeSummary(item));
  } catch (error) {
    throw mapError(error);
  }
};

export const createTrainerWorkoutType = async (
  payload: { name: string; category?: WorkoutTypeCategory | null },
  options?: RequestInit
): Promise<TrainerWorkoutType> => {
  try {
    const response = await customFetch<{ status: number; data: unknown }>(
      '/trainer/workout-types',
      {
        ...options,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(options?.headers ?? {}),
        },
        body: JSON.stringify({
          name: payload.name,
          category: payload.category ?? undefined,
        }),
      }
    );
    return mapWorkoutTypeSummary(
      unwrap<TrainerWorkoutType>(response, 'Не удалось создать тип тренировки.')
    );
  } catch (error) {
    throw mapError(error);
  }
};

export const archiveTrainerWorkoutType = async (
  id: string,
  options?: RequestInit
): Promise<TrainerWorkoutType> => {
  try {
    const response = await customFetch<{ status: number; data: unknown }>(
      `/trainer/workout-types/${id}/archive`,
      {
        ...options,
        method: 'POST',
      }
    );
    return mapWorkoutTypeSummary(
      unwrap<TrainerWorkoutType>(response, 'Не удалось архивировать тип тренировки.')
    );
  } catch (error) {
    throw mapError(error);
  }
};

export const setTrainerBookingWorkoutType = async (
  bookingId: string,
  workoutTypeId: string | null,
  options?: RequestInit
): Promise<SetBookingWorkoutTypeResponse> => {
  try {
    const response = await customFetch<{ status: number; data: unknown }>(
      `/trainer/bookings/${bookingId}/workout-type`,
      {
        ...options,
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(options?.headers ?? {}),
        },
        body: JSON.stringify({ workoutTypeId }),
      }
    );
    const data = unwrap<SetBookingWorkoutTypeResponse>(response, 'Не удалось обновить тип тренировки.');
    return {
      ...data,
      workoutType: data.workoutType ? mapWorkoutTypeSummary(data.workoutType) : data.workoutType,
    };
  } catch (error) {
    throw mapError(error);
  }
};

type SlotLikeWithWorkoutType = {
  workoutType?: WorkoutTypeSummary | null;
};

export const getSlotWorkoutType = (slot: unknown): WorkoutTypeSummary | null => {
  if (!slot || typeof slot !== 'object') {
    return null;
  }
  const value = ((slot as SlotLikeWithWorkoutType).workoutType ?? null) as WorkoutTypeSummary | null;
  return value ? mapWorkoutTypeSummary(value) : null;
};
