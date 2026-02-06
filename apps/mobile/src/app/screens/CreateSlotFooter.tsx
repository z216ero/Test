import { Button } from 'tamagui';
import { t } from '@i18n';

type CreateSlotFooterProps = {
  canSubmit: boolean;
  isPending: boolean;
  multiEnabled: boolean;
  slotCount: number;
  onCreate: () => void;
};

export function CreateSlotFooter({
  canSubmit,
  isPending,
  multiEnabled,
  slotCount,
  onCreate,
}: CreateSlotFooterProps) {
  const isDisabled = !canSubmit || isPending;

  return (
    <Button
      backgroundColor={isDisabled ? '$surfaceMuted' : '$accent'}
      color={isDisabled ? '$muted' : '$accentText'}
      minHeight="$10"
      paddingHorizontal="$4"
      onPress={onCreate}
      disabled={isDisabled}
      opacity={isDisabled ? 0.7 : 1}
    >
      {isPending
        ? t('common.loading')
        : multiEnabled
          ? t('createSlot.createMulti', { count: slotCount })
          : t('createSlot.save')}
    </Button>
  );
}

