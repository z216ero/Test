import { Text, YStack } from 'tamagui';
import { t } from '@i18n';
import { PrimaryButton, SecondaryButton } from '@ui/components';

type PersonalInfoActionsProps = {
  isSaving: boolean;
  isLoading: boolean;
  onSave: () => void;
  onCancel: () => void;
};

export function PersonalInfoActions({
  isSaving,
  isLoading,
  onSave,
  onCancel,
}: PersonalInfoActionsProps) {
  return (
    <YStack gap="$3">
      <PrimaryButton
        onPress={onSave}
        disabled={isSaving || isLoading}
      >
        <Text fontSize="$3" color="$accentText">
          {isSaving ? t('common.loading') : t('profile.personal.save')}
        </Text>
      </PrimaryButton>
      <SecondaryButton
        onPress={onCancel}
        disabled={isSaving}
      >
        <Text fontSize="$3" color="$text">
          {t('profile.personal.cancel')}
        </Text>
      </SecondaryButton>
    </YStack>
  );
}
