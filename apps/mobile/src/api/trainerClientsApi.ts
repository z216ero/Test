import type {
  CreateTrainerClientRequest,
  GetTrainerClientsParams,
  TrainerClientDto,
  UpdateTrainerClientRequest,
} from '@generated/api';
import {
  getTrainerClients,
  patchTrainerClientsId,
  postTrainerClients,
} from '@generated/api';
import { t } from '@i18n';
import { ApiError, unwrap } from './core';
import { ApiTimeoutError } from './fetcher';

const mapTrainerClientError = (error: unknown): Error => {
  if (error instanceof ApiTimeoutError || error instanceof TypeError) {
    return error;
  }

  if (error instanceof ApiError) {
    if (error.status === 400 || error.status === 404 || error.status === 409) {
      return error;
    }

    return new ApiError(t('errors.generic'), error.status, error.details);
  }

  if (error instanceof Error) {
    return new ApiError(error.message);
  }

  return new ApiError(t('errors.generic'));
};

export const getTrainerClientsList = async (
  params?: GetTrainerClientsParams,
  options?: RequestInit
): Promise<TrainerClientDto[]> => {
  try {
    const response = await getTrainerClients(params, options);
    return unwrap<TrainerClientDto[]>(response, t('errors.generic'));
  } catch (error) {
    throw mapTrainerClientError(error);
  }
};

export const createTrainerClient = async (
  payload: CreateTrainerClientRequest,
  options?: RequestInit
): Promise<TrainerClientDto> => {
  try {
    const response = await postTrainerClients(payload, options);
    return unwrap<TrainerClientDto>(response, t('errors.generic'));
  } catch (error) {
    throw mapTrainerClientError(error);
  }
};

export const updateTrainerClient = async (
  id: string,
  payload: UpdateTrainerClientRequest,
  options?: RequestInit
): Promise<TrainerClientDto> => {
  try {
    const response = await patchTrainerClientsId(id, payload, options);
    return unwrap<TrainerClientDto>(response, t('errors.generic'));
  } catch (error) {
    throw mapTrainerClientError(error);
  }
};

export const archiveTrainerClient = async (
  id: string,
  options?: RequestInit
): Promise<TrainerClientDto> =>
  updateTrainerClient(id, { status: 'Archived' }, options);
