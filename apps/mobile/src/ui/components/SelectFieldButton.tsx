import { Button, Text } from 'tamagui';

type SelectFieldButtonProps = {
  value?: string | null;
  placeholder: string;
  onPress: () => void;
  disabled?: boolean;
  height?: number | string;
};

export function SelectFieldButton({
  value,
  placeholder,
  onPress,
  disabled,
  height = 44,
}: SelectFieldButtonProps) {
  const hasValue = Boolean(value && value.trim().length > 0);

  return (
    <Button
      backgroundColor="$background"
      borderRadius="$4"
      borderWidth={1}
      borderColor="$border"
      height={height}
      paddingHorizontal="$3"
      justifyContent="flex-start"
      alignItems="center"
      onPress={onPress}
      disabled={disabled}
    >
      <Text
        color={hasValue ? '$text' : '$muted'}
        width="100%"
        textAlign="left"
      >
        {hasValue ? value : placeholder}
      </Text>
    </Button>
  );
}
