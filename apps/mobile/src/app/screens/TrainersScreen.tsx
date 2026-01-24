import { Text, YStack } from 'tamagui';

export function TrainersScreen() {
  return (
    <YStack
      flex={1}
      alignItems="center"
      justifyContent="center"
      gap="$4"
      padding="$6"
      backgroundColor="$background"
    >
      <Text fontSize="$8" fontWeight="700" color="$text">
        Trainers
      </Text>
      <Text fontSize="$4" color="$muted" textAlign="center">
        TODO: load trainers from API
      </Text>
    </YStack>
  );
}
