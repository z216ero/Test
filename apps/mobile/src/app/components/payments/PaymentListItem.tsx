import { Button, Text, XStack, YStack } from 'tamagui';
import type { PaymentListItemDto } from '@generated/api';
import { t } from '@i18n';
import { formatDateRu, formatTimeRangeRu } from '@utils/datetime';
import { formatPrice } from '@utils/price';
import {
  getPaymentStatus,
  paymentMethodLabel,
  paymentStatusMeta,
} from './paymentUi';

type PaymentListItemProps = {
  item: PaymentListItemDto;
  isUpdating?: boolean;
  onMarkPaid?: () => void;
};

export function PaymentListItem({
  item,
  isUpdating,
  onMarkPaid,
}: PaymentListItemProps) {
  const status = getPaymentStatus(item);
  const statusMeta = paymentStatusMeta(status);
  const start = item.slotStartAtUtc ?? null;
  const end = item.slotEndAtUtc ?? null;
  const dateLabel = start ? formatDateRu(start) : t('common.empty');
  const timeLabel = start && end ? formatTimeRangeRu(start, end) : t('common.empty');
  const amountLabel = formatPrice(item.amount ?? null) ?? t('common.empty');
  const canMarkPaid = status === 'Pending' && !!onMarkPaid;
  const methodLabel = status === 'Paid'
    ? paymentMethodLabel(item.method)
    : null;

  return (
    <YStack
      gap="$3"
      padding="$4"
      backgroundColor="$background"
      borderRadius="$5"
      borderWidth={1}
      borderColor="$border"
    >
      <XStack justifyContent="space-between" alignItems="flex-start" gap="$3">
        <YStack gap="$1" flex={1}>
          <Text fontSize="$5" fontWeight="700" color="$text">
            {(item.clientName ?? '').trim() || t('common.empty')}
          </Text>
          <Text fontSize="$3" color="$muted">
            {`${dateLabel}, ${timeLabel}`}
          </Text>
        </YStack>

        {canMarkPaid ? (
          <Button
            backgroundColor="$primary"
            borderRadius="$3"
            minHeight="$8"
            paddingHorizontal="$4"
            onPress={onMarkPaid}
            disabled={isUpdating}
          >
            <Text color="$accentText" fontSize="$2" fontWeight="700">
              {isUpdating ? t('common.loading') : t('payments.action.markPaid')}
            </Text>
          </Button>
        ) : methodLabel ? (
          <Text fontSize="$3" color="$muted" fontWeight="600">
            {methodLabel}
          </Text>
        ) : null}
      </XStack>

      <XStack justifyContent="space-between" alignItems="center">
        <Text fontSize="$4" fontWeight="700" color="$text">
          {amountLabel}
        </Text>
        <XStack alignItems="center" gap="$2">
          <YStack width="$1" height="$1" borderRadius="$6" backgroundColor={statusMeta.dotColor} />
          <Text fontSize="$3" color={statusMeta.textColor}>
            {statusMeta.label}
          </Text>
        </XStack>
      </XStack>
    </YStack>
  );
}
