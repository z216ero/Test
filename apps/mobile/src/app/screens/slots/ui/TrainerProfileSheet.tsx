import { Sheet } from '@tamagui/sheet';
import Clipboard from '@react-native-clipboard/clipboard';
import { Button, Text, XStack, YStack } from 'tamagui';
import type { AvailableSlotTrainerDto } from '@generated/api';
import { t } from '@i18n';
import { AppIcon } from '@ui/AppIcon';
import { TrainerAvatar } from '@app/components/bookings/TrainerAvatar';
import { useToast } from '@ui/feedback/useToast';

type TrainerProfileSheetProps = {
  open: boolean;
  trainer: AvailableSlotTrainerDto | null;
  onOpenChange: (open: boolean) => void;
};

const hiddenOverlayStyle = { opacity: 0 } as const;

const mapGender = (value?: string | null): string => {
  const normalized = (value ?? '').toLowerCase().trim();
  if (normalized === 'male') {
    return t('slots.trainerSheet.gender.male');
  }
  if (normalized === 'female') {
    return t('slots.trainerSheet.gender.female');
  }
  if (normalized === 'any') {
    return t('slots.trainerSheet.gender.any');
  }
  return t('common.empty');
};

const buildLocation = (trainer: AvailableSlotTrainerDto | null): string => {
  if (!trainer) {
    return t('common.empty');
  }
  const parts = [trainer.cityName, trainer.districtName].filter(
    (value): value is string => Boolean(value && value.trim())
  );
  return parts.length > 0 ? parts.join(', ') : t('common.empty');
};

const buildTrainingTypes = (trainer: AvailableSlotTrainerDto | null): string => {
  const values = trainer?.trainingTypes?.filter((value) => value.trim().length > 0) ?? [];
  return values.length > 0 ? values.join(', ') : t('common.empty');
};

export function TrainerProfileSheet({
  open,
  trainer,
  onOpenChange,
}: TrainerProfileSheetProps) {
  const { showToast } = useToast();
  const trainerName = trainer?.name?.trim() || t('common.empty');
  const location = buildLocation(trainer);
  const trainingTypes = buildTrainingTypes(trainer);
  const phoneNumber = trainer?.phoneNumber?.trim() || '';
  const formattedPhoneNumber = formatRussianPhoneNumber(phoneNumber);
  const rating = typeof trainer?.rating === 'number'
    ? trainer.rating.toFixed(1)
    : null;
  const canCopyPhone = formattedPhoneNumber !== t('common.empty');

  const handleCopyPhone = () => {
    if (!canCopyPhone) {
      return;
    }

    Clipboard.setString(formattedPhoneNumber);
    showToast({
      type: 'success',
      title: t('slots.trainerSheet.phoneCopied'),
    });
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      dismissOnSnapToBottom
      snapPoints={[58]}
      dismissOnOverlayPress
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

        <YStack gap="$3">
          <XStack alignItems="center" gap="$3">
            <TrainerAvatar
              name={trainerName}
              avatarUrl={trainer?.avatarUrl}
              size="$12"
            />
            <YStack gap="$1" flex={1}>
              <Text fontSize="$6" fontWeight="700" color="$text" numberOfLines={2}>
                {trainerName}
              </Text>
              <XStack alignItems="center" gap="$2">
                <AppIcon name="star" size={14} color="$accent" />
                <Text fontSize="$3" color="$muted">
                  {rating
                    ? t('slots.trainerSheet.ratingValue', { value: rating })
                    : t('slots.trainerSheet.ratingEmpty')}
                </Text>
              </XStack>
            </YStack>
          </XStack>
        </YStack>

        <YStack
          backgroundColor="$background"
          borderRadius="$5"
          borderWidth={1}
          borderColor="$border"
          padding="$4"
          gap="$3"
        >
          <YStack gap="$1">
            <Text fontSize="$2" color="$muted">
              {t('slots.trainerSheet.phone')}
            </Text>
            <XStack alignItems="center" justifyContent="space-between" gap="$2">
              <Text fontSize="$3" color="$text" flex={1}>
                {formattedPhoneNumber}
              </Text>
              <Button
                size="$3"
                circular
                chromeless
                disabled={!canCopyPhone}
                onPress={handleCopyPhone}
                accessibilityLabel={t('slots.trainerSheet.copyPhone')}
              >
                <AppIcon name="copy" size={16} color="$muted" />
              </Button>
            </XStack>
          </YStack>

          <YStack gap="$1">
            <Text fontSize="$2" color="$muted">
              {t('slots.trainerSheet.location')}
            </Text>
            <Text fontSize="$3" color="$text">
              {location}
            </Text>
          </YStack>

          <YStack gap="$1">
            <Text fontSize="$2" color="$muted">
              {t('slots.trainerSheet.trainingTypes')}
            </Text>
            <Text fontSize="$3" color="$text">
              {trainingTypes}
            </Text>
          </YStack>

          <YStack gap="$1">
            <Text fontSize="$2" color="$muted">
              {t('slots.trainerSheet.gender')}
            </Text>
            <Text fontSize="$3" color="$text">
              {mapGender(trainer?.gender)}
            </Text>
          </YStack>

          <YStack gap="$1">
            <Text fontSize="$2" color="$muted">
              {t('slots.trainerSheet.worksWithGender')}
            </Text>
            <Text fontSize="$3" color="$text">
              {mapGender(trainer?.worksWithGender)}
            </Text>
          </YStack>
        </YStack>
      </Sheet.Frame>
    </Sheet>
  );
}

const formatRussianPhoneNumber = (value: string): string => {
  const normalized = value.replace(/[\s\-()]/g, '');
  const digits = normalized.startsWith('+7')
    ? normalized.slice(2)
    : normalized.startsWith('8')
      ? normalized.slice(1)
      : '';

  if (!/^\d{10}$/.test(digits)) {
    return t('common.empty');
  }

  return `+7 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 8)}-${digits.slice(8, 10)}`;
};
