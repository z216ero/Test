import type {
  GetTrainersMeReportsSummaryParams,
  TrainerSummaryReportDto,
} from '@generated/api';
import { getTrainersMeReportsSummary } from '@generated/api';
import { t } from '@i18n';
import { ApiError, unwrap } from './core';
import { ApiTimeoutError } from './fetcher';

const mapReportError = (error: unknown): Error => {
  if (error instanceof ApiTimeoutError || error instanceof TypeError) {
    return error;
  }

  if (error instanceof ApiError) {
    if (error.status === 400 || error.status === 403 || error.status === 404) {
      return error;
    }
    return new ApiError(t('errors.generic'), error.status, error.details);
  }

  if (error instanceof Error) {
    return new ApiError(error.message);
  }

  return new ApiError(t('errors.generic'));
};

export const getTrainerSummaryReport = async (
  params?: GetTrainersMeReportsSummaryParams,
  options?: RequestInit
): Promise<TrainerSummaryReportDto> => {
  try {
    const response = await getTrainersMeReportsSummary(params, options);
    return unwrap<TrainerSummaryReportDto>(response, t('errors.generic'));
  } catch (error) {
    throw mapReportError(error);
  }
};
