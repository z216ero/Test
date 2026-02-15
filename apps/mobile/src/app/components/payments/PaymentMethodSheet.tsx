import { Sheet } from '@tamagui/sheet';
import { Button, Text, XStack, YStack } from 'tamagui';
import type { PaymentMethod } from '@api/paymentsApi';
import { t } from '@i18n';
import { AppIcon } from '@ui/AppIcon';
import { paymentMethodLabel, paymentMethods } from './paymentUi';

const hiddenOverlayStyle = { opacity: 0 } as const;

type PaymentMethodSheetProps = {
  open: boolean;
  selectedMethod: PaymentMethod;
  isSubmitting?: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectMethod: (method: PaymentMethod) => void;
  onConfirm: () => void;
};

export function PaymentMethodSheet({
  open,
  selectedMethod,
  isSubmitting,
  onOpenChange,
  onSelectMethod,
  onConfirm,
}: PaymentMethodSheetProps) {
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      dismissOnSnapToBottom
      snapPoints={[55]}
      dismissOnOverlayPress={!isSubmitting}
    >
      <Sheet.Overlay
        animation="fast"
        enterStyle={hiddenOverlayStyle}
        exitStyle={hiddenOverlayStyle}
        backgroundColor="rgba(15, 23, 42, 0.2)"
      />
      <Sheet.Frame
        padding="$5"
        gap="$4"
        backgroundColor="$backgroundSoft"
        borderTopLeftRadius="$6"
        borderTopRightRadius="$6"
      >
        <Sheet.Handle />
        <YStack gap="$1">
          <Text fontSize="$6" fontWeight="700" color="$text">
            {t('payments.sheet.title')}
          </Text>
          <Text fontSize="$3" color="$muted">
            {t('payments.sheet.subtitle')}
          </Text>
        </YStack>

        <YStack gap="$2">
          {paymentMethods.map((method) => {
            const active = method === selectedMethod;
            return (
              <Button
                key={method}
                unstyled
                onPress={() => onSelectMethod(method)}
                disabled={isSubmitting}
              >
                <XStack
                  minHeight="$10"
                  paddingHorizontal="$4"
                  backgroundColor="$background"
                  borderWidth={1}
                  borderColor={active ? '$accent' : '$border'}
                  borderRadius="$4"
                  alignItems="center"
                  justifyContent="space-between"
                >
                  <Text color="$text" fontSize="$4" fontWeight={active ? '700' : '600'}>
                    {paymentMethodLabel(method)}
                  </Text>
                  {active ? <AppIcon name="check" size={18} color="$accent" /> : null}
                </XStack>
              </Button>
            );
          })}
        </YStack>

        <XStack gap="$2">
          <Button
            flex={1}
            unstyled
            onPress={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            <XStack
              flex={1}
              minHeight="$10"
              backgroundColor="$surfaceMuted"
              borderWidth={1}
              borderColor="$border"
              borderRadius="$4"
              alignItems="center"
              justifyContent="center"
            >
              <Text color="$text">{t('profile.personal.cancel')}</Text>
            </XStack>
          </Button>
          <Button
            flex={1}
            unstyled
            onPress={onConfirm}
            disabled={isSubmitting}
          >
            <XStack
              flex={1}
              minHeight="$10"
              backgroundColor="$accent"
              borderRadius="$4"
              alignItems="center"
              justifyContent="center"
            >
              <Text color="$accentText">
                {isSubmitting ? t('common.loading') : t('payments.sheet.confirm')}
              </Text>
            </XStack>
          </Button>
        </XStack>
      </Sheet.Frame>
    </Sheet>
  );
}
