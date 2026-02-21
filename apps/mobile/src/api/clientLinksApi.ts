import { ApiError, unwrap } from './core';
import { customFetch } from './custom-fetch';
import { ApiTimeoutError } from './fetcher';

export type TrainerClientLink = {
  id: string;
  trainerId: string;
  clientUserId: string;
  status: 'Pending' | 'Accepted' | 'Rejected' | 'Revoked' | string;
  requestedAtUtc: string;
  respondedAtUtc?: string | null;
  lastRequestAtUtc: string;
  rejectedUntilUtc?: string | null;
  trainerName?: string | null;
  trainerCityName?: string | null;
  clientName?: string | null;
  clientPhone?: string | null;
};

export type SearchTrainerClientByPhoneResult = {
  clientUserId: string;
  displayName: string;
  maskedPhone: string;
};

export type PendingCount = {
  count: number;
};

const mapError = (error: unknown): Error => {
  if (error instanceof ApiTimeoutError || error instanceof TypeError) {
    return error;
  }

  if (error instanceof ApiError) {
    if (error.status === 400 || error.status === 403 || error.status === 404 || error.status === 409) {
      return error;
    }
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error('Unexpected API error.');
};

export const searchTrainerClientByPhone = async (
  phone: string
): Promise<SearchTrainerClientByPhoneResult> => {
  try {
    const response = await customFetch<{ status: number; data: unknown }>(
      '/trainer/clients/link/search-by-phone',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      }
    );
    return unwrap<SearchTrainerClientByPhoneResult>(
      response,
      'Unable to find client by phone.'
    );
  } catch (error) {
    throw mapError(error);
  }
};

export const requestTrainerClientLink = async (
  clientUserId: string
): Promise<TrainerClientLink> => {
  try {
    const response = await customFetch<{ status: number; data: unknown }>(
      '/trainer/clients/link/request',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientUserId }),
      }
    );
    return unwrap<TrainerClientLink>(response, 'Unable to request client link.');
  } catch (error) {
    throw mapError(error);
  }
};

export const getTrainerClientLinks = async (): Promise<TrainerClientLink[]> => {
  const response = await customFetch<{ status: number; data: unknown }>(
    '/trainer/clients/links',
    { method: 'GET' }
  );
  return unwrap<TrainerClientLink[]>(response, 'Unable to load linked clients.');
};

export const revokeTrainerClientLink = async (linkId: string): Promise<void> => {
  try {
    const response = await customFetch<{ status: number; data: unknown }>(
      `/trainer/clients/link/${linkId}`,
      { method: 'DELETE' }
    );
    unwrap<unknown>(response, 'Unable to revoke client link.');
  } catch (error) {
    throw mapError(error);
  }
};

export const getClientLinkRequests = async (): Promise<TrainerClientLink[]> => {
  const response = await customFetch<{ status: number; data: unknown }>(
    '/client/links/requests',
    { method: 'GET' }
  );
  return unwrap<TrainerClientLink[]>(response, 'Unable to load link requests.');
};

export const getClientAcceptedLinks = async (): Promise<TrainerClientLink[]> => {
  const response = await customFetch<{ status: number; data: unknown }>(
    '/client/links',
    { method: 'GET' }
  );
  return unwrap<TrainerClientLink[]>(response, 'Unable to load trainer links.');
};

export const acceptClientLinkRequest = async (linkId: string): Promise<TrainerClientLink> => {
  try {
    const response = await customFetch<{ status: number; data: unknown }>(
      `/client/links/${linkId}/accept`,
      { method: 'POST' }
    );
    return unwrap<TrainerClientLink>(response, 'Unable to accept link request.');
  } catch (error) {
    throw mapError(error);
  }
};

export const rejectClientLinkRequest = async (linkId: string): Promise<TrainerClientLink> => {
  try {
    const response = await customFetch<{ status: number; data: unknown }>(
      `/client/links/${linkId}/reject`,
      { method: 'POST' }
    );
    return unwrap<TrainerClientLink>(response, 'Unable to reject link request.');
  } catch (error) {
    throw mapError(error);
  }
};

export const revokeClientLink = async (linkId: string): Promise<void> => {
  try {
    const response = await customFetch<{ status: number; data: unknown }>(
      `/client/links/${linkId}`,
      { method: 'DELETE' }
    );
    unwrap<unknown>(response, 'Unable to remove trainer link.');
  } catch (error) {
    throw mapError(error);
  }
};

export const getPendingLinkRequestsCount = async (
  options?: RequestInit
): Promise<number> => {
  const response = await customFetch<{ status: number; data: unknown }>(
    '/client/me/pending-link-requests/count',
    {
      ...options,
      method: 'GET',
    }
  );
  const payload = unwrap<PendingCount>(response, 'Unable to load pending link requests count.');
  return payload.count ?? 0;
};
