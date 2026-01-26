import type { ProblemDetails } from '../generated/api';

const firstProblemError = (errors: unknown): string | null => {
  if (!errors || typeof errors !== 'object') {
    return null;
  }

  const errorMap = errors as Record<string, unknown>;
  const firstKey = Object.keys(errorMap)[0];
  if (!firstKey) {
    return null;
  }

  const firstValue = errorMap[firstKey];
  if (!Array.isArray(firstValue)) {
    return null;
  }

  const firstMessage = firstValue[0];
  return typeof firstMessage === 'string' ? firstMessage : null;
};

const getProblemMessage = (data: unknown, fallback: string): string => {
  if (typeof data === 'string') {
    const trimmed = data.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }

  if (data && typeof data === 'object') {
    const problem = data as ProblemDetails;
    const error = firstProblemError(
      (problem as { errors?: unknown }).errors
    );
    if (error) {
      return error;
    }

    if (problem.title && problem.detail) {
      return `${problem.title}: ${problem.detail}`;
    }

    if (problem.title) {
      return problem.title;
    }

    if (problem.detail) {
      return problem.detail;
    }
  }

  return fallback;
};

export class ApiError extends Error {
  status?: number;
  details?: unknown;

  constructor(message: string, status?: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

type ApiResponseLike = { status: number; data: unknown };

export const unwrap = <T>(
  response: ApiResponseLike,
  fallbackMessage: string
): T => {
  if (response.status >= 200 && response.status < 300) {
    return response.data as T;
  }

  const message = getProblemMessage(response.data, fallbackMessage);
  throw new ApiError(message, response.status, response.data);
};

export const getUiErrorMessage = (error: unknown): string => {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Something went wrong. Please try again.';
};
