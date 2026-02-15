import type { PaymentListItemDto } from '@generated/api';
import { t } from '@i18n';
import type { PaymentMethod } from '@api/paymentsApi';

export type PaymentItemStatus = 'Pending' | 'Paid' | 'Refunded';

type PaymentStatusMeta = {
  label: string;
  dotColor: string;
  textColor: string;
};

export const getPaymentStatus = (item: PaymentListItemDto): PaymentItemStatus => {
  const raw = (item.status ?? '').trim();
  if (raw === 'Paid') {
    return 'Paid';
  }
  if (raw === 'Refunded') {
    return 'Refunded';
  }
  return 'Pending';
};

export const paymentStatusMeta = (status: PaymentItemStatus): PaymentStatusMeta => {
  switch (status) {
    case 'Paid':
      return {
        label: t('payments.status.paid'),
        dotColor: '$accent',
        textColor: '$text',
      };
    case 'Refunded':
      return {
        label: t('payments.status.refunded'),
        dotColor: '$muted',
        textColor: '$muted',
      };
    case 'Pending':
    default:
      return {
        label: t('payments.status.pending'),
        dotColor: '$danger',
        textColor: '$danger',
      };
  }
};

export const paymentMethodLabel = (method: string | null | undefined): string => {
  const normalized = (method ?? '').trim();
  switch (normalized) {
    case 'Cash':
      return t('payments.method.cash');
    case 'Transfer':
      return t('payments.method.transfer');
    case 'SBP':
      return t('payments.method.sbp');
    case 'Other':
      return t('payments.method.other');
    default:
      return t('payments.method.unknown');
  }
};

export const paymentMethods: PaymentMethod[] = ['Cash', 'Transfer', 'SBP', 'Other'];
