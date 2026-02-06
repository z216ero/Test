import { ApiError } from './core';
import { ApiHttpError, ApiTimeoutError } from './fetcher';

export type ApiErrorKind =
  | 'network'
  | 'timeout'
  | 'validation'
  | 'conflict'
  | 'notFound'
  | 'unauthorized'
  | 'forbidden'
  | 'rateLimit'
  | 'server'
  | 'unknown';

export type PresentedError = {
  title: string;
  message: string;
  kind: ApiErrorKind;
  status?: number;
};

export const shouldShowErrorToast = (presented: PresentedError): boolean => (
  presented.kind === 'server'
  || presented.kind === 'network'
  || presented.kind === 'timeout'
  || presented.kind === 'unknown'
);

const getStatus = (error: unknown): number | undefined => {
  if (error instanceof ApiHttpError || error instanceof ApiError) {
    return error.status;
  }

  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === 'number' ? status : undefined;
  }

  return undefined;
};

const isNetworkError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.name === 'TypeError' ||
    /network request failed/i.test(error.message) ||
    /failed to fetch/i.test(error.message)
  );
};

const buildPresentedError = (
  kind: ApiErrorKind,
  title: string,
  message: string,
  status?: number
): PresentedError => ({
  title,
  message,
  kind,
  status,
});

export const presentApiError = (error: unknown): PresentedError => {
  if (error instanceof ApiTimeoutError) {
    return buildPresentedError(
      'timeout',
      'Время ожидания истекло',
      'Сервер не ответил. Попробуйте ещё раз.'
    );
  }

  const status = getStatus(error);
  if (typeof status === 'number') {
    if (status >= 500) {
      return buildPresentedError(
        'server',
        'Ошибка сервера',
        'Попробуйте позже.',
        status
      );
    }

    switch (status) {
      case 400:
        return buildPresentedError(
          'validation',
          'Проверьте данные',
          'Некоторые поля заполнены неверно.',
          status
        );
      case 401:
        return buildPresentedError(
          'unauthorized',
          'Нужен вход',
          'Войдите, чтобы продолжить.',
          status
        );
      case 403:
        return buildPresentedError(
          'forbidden',
          'Доступ запрещён',
          'Недостаточно прав для этого действия.',
          status
        );
      case 404:
        return buildPresentedError(
          'notFound',
          'Не найдено',
          'Запрошенные данные не найдены.',
          status
        );
      case 409:
        return buildPresentedError(
          'conflict',
          'Конфликт изменений',
          'Данные уже изменились. Обновите список.',
          status
        );
      case 429:
        return buildPresentedError(
          'rateLimit',
          'Слишком много запросов',
          'Подождите немного и попробуйте снова.',
          status
        );
      default:
        return buildPresentedError(
          'unknown',
          'Ошибка',
          'Что-то пошло не так. Попробуйте ещё раз.',
          status
        );
    }
  }

  if (isNetworkError(error)) {
    return buildPresentedError(
      'network',
      'Нет соединения',
      'Проверьте интернет и попробуйте снова.'
    );
  }

  return buildPresentedError(
    'unknown',
    'Ошибка',
    'Что-то пошло не так. Попробуйте ещё раз.'
  );
};
