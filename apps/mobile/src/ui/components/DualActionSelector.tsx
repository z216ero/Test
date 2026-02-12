import { Button, Text, XStack } from 'tamagui';

type DualActionSelectorProps = {
  selectLabel: string;
  cancelLabel: string;
  selectedAction?: 'select' | 'cancel' | null;
  onSelect: () => void;
  onCancel: () => void;
  selectDisabled?: boolean;
  cancelDisabled?: boolean;
  disabled?: boolean;
};

export function DualActionSelector({
  selectLabel,
  cancelLabel,
  selectedAction = null,
  onSelect,
  onCancel,
  selectDisabled,
  cancelDisabled,
  disabled,
}: DualActionSelectorProps) {
  const isSelectActive = selectedAction === 'select';
  const isCancelActive = selectedAction === 'cancel';

  return (
    <XStack gap="$2">
      <Button
        flex={1}
        unstyled
        onPress={onSelect}
        disabled={disabled || selectDisabled}
      >
        <XStack
          minHeight="$9"
          borderRadius="$4"
          borderWidth={1}
          borderColor={isSelectActive ? '$accent' : '$border'}
          backgroundColor={isSelectActive ? '$accent' : '$background'}
          alignItems="center"
          justifyContent="center"
        >
          <Text color={isSelectActive ? '$accentText' : '$text'} fontWeight="600">
            {selectLabel}
          </Text>
        </XStack>
      </Button>
      <Button
        flex={1}
        unstyled
        onPress={onCancel}
        disabled={disabled || cancelDisabled}
      >
        <XStack
          minHeight="$9"
          borderRadius="$4"
          borderWidth={1}
          borderColor={isCancelActive ? '$danger' : '$border'}
          backgroundColor={isCancelActive ? '$danger' : '$background'}
          alignItems="center"
          justifyContent="center"
        >
          <Text color={isCancelActive ? '$accentText' : '$text'} fontWeight="600">
            {cancelLabel}
          </Text>
        </XStack>
      </Button>
    </XStack>
  );
}
