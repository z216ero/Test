import type {
  GetTrainerPaymentsParams,
  PaymentDto,
  PaymentListItemDto,
} from '@generated/api';
import {
  getBookingsBookingIdPayment,
  getTrainerPayments,
  patchPaymentsPaymentIdMarkPaid,
  patchPaymentsPaymentIdRefund,
} from '@generated/api';
import { t } from '@i18n';
import { ApiError, unwrap } from './core';
import { ApiTimeoutError } from './fetcher';

export type TrainerPaymentsStatusFilter = 'All' | 'Pending' | 'Paid' | 'Refunded';
export type PaymentMethod = 'Cash' | 'Transfer' | 'SBP';

export class PaymentConflictError extends ApiError {}
export class PaymentNotFoundError extends ApiError {}

const mapPaymentError = (error: unknown): Error => {
  if (error instanceof ApiTimeoutError) {
    return error;
  }

  if (error instanceof TypeError) {
    return error;
  }

  if (error instanceof ApiError) {
    if (error.status === 409) {
      return new PaymentConflictError(t('errors.conflict'), error.status, error.details);
    }

    if (error.status === 404) {
      return new PaymentNotFoundError(t('errors.notFound'), error.status, error.details);
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

export const getTrainerPaymentsList = async (
  params?: GetTrainerPaymentsParams,
  options?: RequestInit
): Promise<PaymentListItemDto[]> => {
  try {
    const response = await getTrainerPayments(params, options);
    return unwrap<PaymentListItemDto[]>(response, t('errors.generic'));
  } catch (error) {
    throw mapPaymentError(error);
  }
};

export const getBookingPayment = async (
  bookingId: string,
  options?: RequestInit
): Promise<PaymentDto> => {
  try {
    const response = await getBookingsBookingIdPayment(bookingId, options);
    return unwrap<PaymentDto>(response, t('errors.generic'));
  } catch (error) {
    throw mapPaymentError(error);
  }
};

export const markPaymentPaid = async (
  paymentId: string,
  method: PaymentMethod,
  options?: RequestInit
): Promise<PaymentDto> => {
  try {
    const response = await patchPaymentsPaymentIdMarkPaid(paymentId, { method }, options);
    return unwrap<PaymentDto>(response, t('errors.generic'));
  } catch (error) {
    throw mapPaymentError(error);
  }
};

export const refundPayment = async (
  paymentId: string,
  options?: RequestInit
): Promise<PaymentDto> => {
  try {
    const response = await patchPaymentsPaymentIdRefund(paymentId, options);
    return unwrap<PaymentDto>(response, t('errors.generic'));
  } catch (error) {
    throw mapPaymentError(error);
  }
};
