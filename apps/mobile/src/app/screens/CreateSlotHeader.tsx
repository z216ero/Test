import { Button, Text, XStack } from 'tamagui';
import { AppIcon } from '@ui/AppIcon';

type CreateSlotHeaderProps = {
  title: string;
  onBack: () => void;
};

export function CreateSlotHeader({ title, onBack }: CreateSlotHeaderProps) {
  return (
    <XStack alignItems="center" gap="$3">
      <Button
        backgroundColor="$background"
        borderRadius="$4"
        borderWidth={1}
        borderColor="$border"
        padding="$3"
        onPress={onBack}
      >
        <AppIcon name="chevronLeft" size={18} color="$text" />
      </Button>
      <Text fontSize="$8" fontWeight="700" color="$text">
        {title}
      </Text>
    </XStack>
  );
}

