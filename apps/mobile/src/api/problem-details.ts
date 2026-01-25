import type { ProblemDetails } from '../generated/api';

const firstProblemError = (errors?: ProblemDetails['errors']): string | null => {
  if (!errors) {
    return null;
  }

  const firstKey = Object.keys(errors)[0];
  if (!firstKey) {
    return null;
  }

  const firstMessage = errors[firstKey]?.[0];
  return firstMessage ?? null;
};

export const getProblemDetailsMessage = (
  data: unknown,
  fallback: string
): string => {
  if (typeof data === 'string') {
    const trimmed = data.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }

  if (data && typeof data === 'object') {
    const problem = data as ProblemDetails;
    const error = firstProblemError(problem.errors);
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
