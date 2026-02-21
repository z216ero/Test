import { Button, Text, XStack, YStack } from 'tamagui';
import type { PaymentMethod as BookingPaymentMethod } from '@api/paymentsApi';
import { t } from '@i18n';
import { paymentMethodLabel } from '@app/components/payments/paymentUi';

type TrainerSlotPaymentSectionProps = {
  canTogglePayment: boolean;
  paymentStatus: string;
  methods: BookingPaymentMethod[];
  selectedMethod: BookingPaymentMethod;
  onSelectMethod: (method: BookingPaymentMethod) => void;
  onMarkPaid: () => void;
  onMarkPending: () => void;
  isPending: boolean;
};

export function TrainerSlotPaymentSection({
  canTogglePayment,
  paymentStatus,
  methods,
  selectedMethod,
  onSelectMethod,
  onMarkPaid,
  onMarkPending,
  isPending,
}: TrainerSlotPaymentSectionProps) {
  if (!canTogglePayment) {
    return null;
  }

  return (
    <YStack
      gap="$3"
      padding="$4"
      borderRadius="$4"
      borderWidth={1}
      borderColor="$border"
      backgroundColor="$background"
    >
      <Text fontSize="$4" fontWeight="700" color="$text">
        {t('slotDetails.paymentTitle')}
      </Text>
      <Text fontSize="$3" color="$muted">
        {paymentStatus === 'paid'
          ? t('bookings.payment.paid')
          : t('bookings.payment.unpaid')}
      </Text>
      {paymentStatus !== 'paid' ? (
        <YStack gap="$2">
          <XStack gap="$2" flexWrap="wrap">
            {methods.map((method) => {
              const selected = method === selectedMethod;
              return (
                <Button
                  key={method}
                  backgroundColor={selected ? '$surfaceMuted' : '$background'}
                  borderWidth={1}
                  borderColor={selected ? '$accent' : '$border'}
                  borderRadius="$4"
                  minHeight="$8"
                  onPress={() => onSelectMethod(method)}
                  disabled={isPending}
                >
                  <Text color="$text" fontSize="$2" fontWeight={selected ? '700' : '600'}>
                    {paymentMethodLabel(method)}
                  </Text>
                </Button>
              );
            })}
          </XStack>
          <Button
            backgroundColor="$accent"
            color="$accentText"
            borderRadius="$4"
            minHeight="$9"
            onPress={onMarkPaid}
            disabled={isPending}
          >
            {isPending ? t('common.loading') : t('slotDetails.paymentMarkPaid')}
          </Button>
        </YStack>
      ) : (
        <Button
          backgroundColor="$background"
          borderRadius="$4"
          borderWidth={1}
          borderColor="$border"
          minHeight="$9"
          onPress={onMarkPending}
          disabled={isPending}
        >
          <Text color="$text">
            {isPending ? t('common.loading') : t('slotDetails.paymentMarkPending')}
          </Text>
        </Button>
      )}
    </YStack>
  );
}

