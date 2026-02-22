import { Text, XStack } from 'tamagui';

type WorkoutTypeChipProps = {
  label?: string | null;
  archived?: boolean;
  compact?: boolean;
};

export function WorkoutTypeChip({
  label,
  archived = false,
  compact = false,
}: WorkoutTypeChipProps) {
  const text = (label ?? '').trim();
  if (!text) {
    return null;
  }

  return (
    <XStack
      alignItems="center"
      minHeight={compact ? '$6' : '$7'}
      borderRadius="$3"
      borderWidth={1}
      borderColor={archived ? '$border' : '$accent'}
      backgroundColor="$surfaceMuted"
      paddingHorizontal={compact ? '$2' : '$3'}
      paddingVertical={compact ? '$1' : '$1.5'}
      maxWidth="100%"
    >
      <Text
        fontSize={compact ? '$1' : '$2'}
        lineHeight={compact ? 14 : 16}
        color={archived ? '$muted' : '$accent'}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {text}
        {archived ? ' (архив)' : ''}
      </Text>
    </XStack>
  );
}
