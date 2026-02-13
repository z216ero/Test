import { Button, Text, XStack, YStack } from 'tamagui';
import { AppIcon } from '@ui/AppIcon';

type TrainerAttendanceQueueCardProps = {
  title: string;
  subtitle: string;
  count: number;
  onPress: () => void;
};

export function TrainerAttendanceQueueCard({
  title,
  subtitle,
  count,
  onPress,
}: TrainerAttendanceQueueCardProps) {
  return (
    <Button
      unstyled
      onPress={onPress}
      disabled={count <= 0}
      opacity={count > 0 ? 1 : 0.6}
    >
      <YStack
        gap="$2"
        padding="$4"
        backgroundColor="$background"
        borderRadius="$6"
        borderWidth={1}
        borderColor="$border"
      >
        <XStack justifyContent="space-between" alignItems="center" gap="$3">
          <YStack gap="$1" flex={1}>
            <Text fontSize="$4" fontWeight="700" color="$text">
              {title}
            </Text>
            <Text fontSize="$3" color="$muted">
              {subtitle}
            </Text>
          </YStack>
          <XStack alignItems="center" gap="$2">
            <Text fontSize="$6" fontWeight="700" color="$text">
              {count}
            </Text>
            <AppIcon name="chevronRight" size={18} color="$muted" />
          </XStack>
        </XStack>
      </YStack>
    </Button>
  );
}
